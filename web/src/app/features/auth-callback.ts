import { afterNextRender, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';

@Component({ template: `<main class="workspace narrow"><p class="eyebrow">Tu cuenta</p><h1>Iniciar sesión</h1><p role="status">{{ message() }}</p><button type="button" (click)="auth.login()" [disabled]="auth.busy()">Volver a intentarlo</button></main>` })
export class AuthCallback {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly message = signal('Validando tu sesión…');
  constructor() { afterNextRender(async () => { try { await this.router.navigateByUrl(await this.auth.completeLogin()); } catch { this.message.set('No se completó el inicio de sesión. Puedes volver a intentarlo.'); } }); }
}
