import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';
import { RuntimeConfig } from '../core/runtime-config';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#contenido">Ir al contenido</a>
    <header class="app-header">
      <a routerLink="/" class="brand" aria-label="CotiTrama, inicio"><span class="brand-mark" aria-hidden="true">ct</span>CotiTrama</a>
      <nav aria-label="Principal">
        <a routerLink="/cotizar" routerLinkActive="active">Cotizar</a>
        <a routerLink="/catalogos" routerLinkActive="active">Catálogos</a>
      </nav>
      <div class="session-actions">
        @if (config.settings().demo) { <span class="demo-label">Demostración</span> }
        @else if (auth.available) { <button class="text-button" type="button" (click)="auth.logout()">Cerrar sesión</button> }
        @else { <button type="button" class="compact" [disabled]="auth.busy()" (click)="auth.login(router.url)">Iniciar sesión</button> }
      </div>
    </header>
    @if (config.error()) { <p class="notice error" role="alert">{{ config.error() }}</p> }
    @if (auth.error()) { <p class="notice error" role="alert">{{ auth.error() }}</p> }
    @if (config.settings().demo) { <div class="demo-strip">Catálogo de demostración · Datos sintéticos · Las propuestas se conservan durante esta sesión del servidor.</div> }
    <div id="contenido" tabindex="-1"><router-outlet /></div>
    <footer class="app-footer"><span>CotiTrama</span><span>Catálogos versionados. Propuestas reproducibles.</span></footer>
  `,
})
export class Shell { protected readonly auth = inject(Auth); protected readonly config = inject(RuntimeConfig); protected readonly router = inject(Router); }
