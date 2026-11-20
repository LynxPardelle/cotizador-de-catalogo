import { afterNextRender, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';
import { RuntimeConfig } from '../core/runtime-config';
import { WorkspaceContext } from '../core/workspace-context';
import { roleLabel } from '../data/team-api';
import { UsageContext } from '../core/usage-context';
import { ApplicationsAccess } from '../core/applications-access';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#contenido">Ir al contenido</a>
    <header class="app-header">
      <a routerLink="/" class="brand" aria-label="CotiTrama, inicio"><span class="brand-mark" aria-hidden="true">ct</span>CotiTrama</a>
      <nav aria-label="Principal">
        <a routerLink="/cotizar" routerLinkActive="active">Cotizar</a>
        <a routerLink="/catalogos" routerLinkActive="active">Catálogos</a>
        <a routerLink="/equipo" routerLinkActive="active">Equipo</a>
        <a routerLink="/consumo" routerLinkActive="active">Consumo</a>
        @if(auth.available&&auth.role==='admin'){<a routerLink="/piloto" routerLinkActive="active">Piloto</a>}
        @if(signedIn()&&applicationsAccess.allowed()){<a routerLink="/piloto/solicitudes" routerLinkActive="active">Solicitudes</a>}
      </nav>
      <div class="session-actions">
        @if (config.settings().demo) { <span class="demo-label">Demostración</span> }
        @else if (auth.available) { <button class="text-button" type="button" (click)="auth.logout()">Cerrar sesión</button> }
        @else { <button type="button" class="compact" [disabled]="auth.busy()" (click)="auth.login(router.url)">Iniciar sesión</button> }
      </div>
    </header>
    @if (auth.available && workspace.memberships().length > 1) { <div class="workspace-switcher"><label for="active-workspace">Espacio activo</label><select id="active-workspace" (change)="switchWorkspace($any($event.target).value)">@for (membership of workspace.memberships(); track membership.organizationId) { <option [value]="membership.organizationId" [selected]="membership.organizationId === workspace.activeOrganizationId()">{{ workspace.label(membership.organizationId) }} · {{ roleLabel(membership.role) }}</option> }</select><span>Cambiar de espacio abre una nueva cotización.</span></div> }
    @if (workspace.error()) { <div class="notice error" role="alert">{{ workspace.error() }} <button class="text-button" type="button" [disabled]="workspace.busy()" (click)="workspace.load()">Volver a comprobar acceso</button></div> }
    @if (auth.available && usage.alerts().length) { <div class="usage-banner" role="status"><span>@for (item of usage.alerts(); track item.key) { <strong>{{ item.label }}: {{ usage.alertLabel(item.metric) }}.</strong> }</span><a routerLink="/consumo">Ver consumo →</a></div> }
    @if (config.error()) { <p class="notice error" role="alert">{{ config.error() }}</p> }
    @if (auth.error()) { <p class="notice error" role="alert">{{ auth.error() }}</p> }
    @if (config.settings().demo) { <div class="demo-strip">Catálogo de demostración · Datos sintéticos · Las propuestas se conservan durante esta sesión del servidor.</div> }
    <div id="contenido" tabindex="-1"><router-outlet /></div>
    <footer class="app-footer"><span>CotiTrama</span><span>Catálogos versionados. Propuestas reproducibles.</span></footer>
  `,
})
export class Shell {
  protected readonly auth = inject(Auth); protected readonly config = inject(RuntimeConfig); protected readonly router = inject(Router); protected readonly workspace = inject(WorkspaceContext); protected readonly roleLabel = roleLabel;
  private readonly document = inject(DOCUMENT); protected readonly usage = inject(UsageContext); private readonly ready = signal(false);
  protected readonly applicationsAccess=inject(ApplicationsAccess);private readonly clock=signal(Date.now());protected readonly signedIn=computed(()=>{this.clock();return this.auth.available;});
  constructor() {
    const destroy=inject(DestroyRef);
    afterNextRender(() => { if(this.config.browser){this.ready.set(true);const timer=setInterval(()=>this.clock.set(Date.now()),1000);destroy.onDestroy(()=>clearInterval(timer));} });
    effect(() => { const ready = this.ready(); const organizationId = this.workspace.activeOrganizationId(); this.workspace.sessionVersion(); const available = this.auth.available; if (ready) untracked(() => { if (available && organizationId) void this.usage.load(); else this.usage.reset(); }); });
    effect(()=>{const ready=this.ready();const signedIn=this.signedIn();this.workspace.sessionVersion();untracked(()=>{if(ready&&signedIn)void this.applicationsAccess.check();else this.applicationsAccess.reset();});});
  }
  protected switchWorkspace(organizationId: string) { if (this.workspace.select(organizationId)) this.document.location.assign('/cotizar'); }
}
