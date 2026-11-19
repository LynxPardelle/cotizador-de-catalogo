import { DatePipe } from '@angular/common';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { WorkspaceContext } from '../../core/workspace-context';
import { apiMessage } from '../../data/catalog-api';
import { Invitation as InvitationDetails, roleLabel, TeamApi } from '../../data/team-api';

@Component({
  imports: [DatePipe, RouterLink],
  template: `<main class="workspace narrow invitation-page"><p class="eyebrow">Sumarte a un espacio</p><h1>Tu invitación a CotiTrama</h1><p class="lede">Acepta la invitación con la cuenta que usa el correo de la persona invitada.</p>
  @if (!auth.available) { <section class="empty-state"><h2>Continúa con tu cuenta</h2><p>Inicia sesión o crea una cuenta y verifica tu correo. Después volverás aquí para aceptar.</p><div class="invitation-auth-actions"><button data-testid="invitation-login" type="button" [disabled]="auth.busy()" (click)="login()">Iniciar sesión</button><button type="button" class="text-button" [disabled]="auth.busy()" (click)="signup()">Crear una cuenta</button></div></section> }
  @else {
    @if (busy()) { <p class="loading" role="status">Comprobando la invitación…</p> }
    @if (error()) { <p class="notice error" role="alert">{{ error() }}</p><button type="button" class="text-button" [disabled]="busy()" (click)="load()">Volver a comprobar</button> }
    @if (invitation(); as invitation) { <section class="invitation-details"><h2>Te esperan en otro espacio</h2><dl><div><dt>Correo invitado</dt><dd>{{ invitation.email }}</dd></div><div><dt>Tu rol</dt><dd>{{ roleLabel(invitation.role) }}</dd></div><div><dt>Válida hasta</dt><dd>{{ invitation.expiresAt | date:'dd/MM/yyyy HH:mm':'UTC' }} UTC</dd></div></dl><p class="muted">Conservarás tus espacios actuales. Podrás cambiar entre ellos desde la navegación.</p><button type="button" [disabled]="busy()" (click)="accept()">Aceptar invitación</button></section> }
    @if (accepted()) { <p class="notice success" role="status">Ya formas parte del espacio.</p><a class="button" routerLink="/cotizar">Abrir el espacio →</a> }
  }</main>`,
})
export class Invitation {
  protected readonly auth = inject(Auth); private readonly api = inject(TeamApi); private readonly workspace = inject(WorkspaceContext); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  protected readonly invitation = signal<InvitationDetails | undefined>(undefined); protected readonly error = signal(''); protected readonly busy = signal(false); protected readonly accepted = signal(false); protected readonly roleLabel = roleLabel;
  constructor() { afterNextRender(() => { if (this.auth.available) void this.load(); }); }
  private token() { return this.route.snapshot.paramMap.get('token') ?? ''; }
  private returnPath() { return `/invitacion/${encodeURIComponent(this.token())}`; }
  protected login() { void this.auth.login(this.returnPath()); }
  protected signup() { void this.auth.signup(this.returnPath()); }
  protected async load() {
    this.busy.set(true); this.error.set(''); this.invitation.set(undefined);
    try { this.invitation.set((await this.api.invitation(this.token())).invitation); }
    catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  protected async accept() {
    if (this.busy() || !this.invitation()) return;
    this.busy.set(true); this.error.set('');
    try { const result = await this.api.accept(this.token()); await this.workspace.load(result.membership.organizationId); this.invitation.set(undefined); this.accepted.set(true); await this.router.navigateByUrl('/cotizar'); }
    catch (error) { this.error.set(this.message(error)); }
    finally { this.busy.set(false); }
  }
  private message(error: unknown) {
    const status = (error as { status?: number }).status;
    if (status === 410) return 'Esta invitación ha caducado. Pide al administrador que cree una nueva.';
    if (status === 404) return 'No encontramos esta invitación para tu cuenta. Comprueba que usas el correo al que la enviaron.';
    return apiMessage(error);
  }
}
