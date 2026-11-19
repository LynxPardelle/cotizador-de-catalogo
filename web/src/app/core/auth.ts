import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders, provideAppInitializer, signal } from '@angular/core';
import { RuntimeConfig } from './runtime-config';
import { DOCUMENT } from '@angular/common';

interface TokenSession { accessToken: string; expiresAt: number }
const TOKEN_KEY = 'cotitrama.session';
const FLOW_KEY = 'cotitrama.pkce';

export function safeReturnPath(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !path.startsWith('/auth/') ? path : '/cotizar';
}
function payload(token: string): Record<string, unknown> {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  readonly config = inject(RuntimeConfig);
  private readonly document = inject(DOCUMENT);
  private readonly session = signal<TokenSession | undefined>(undefined);
  readonly error = signal('');
  readonly busy = signal(false);
  get available() { return this.config.settings().demo || !!this.bearer(); }
  get role(): string {
    if (this.config.settings().demo) return 'admin';
    const claims = payload(this.bearer());
    const raw = claims['cognito:groups'];
    const groups = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.replace(/^\[|\]$/g, '').split(',').map((v) => v.trim().replace(/^"|"$/g, '')) : [];
    const match = groups.find((v: unknown) => typeof v === 'string' && /^org:[a-zA-Z0-9_-]+:(admin|seller|reader)$/.test(v));
    return typeof match === 'string' ? match.split(':')[2] : 'reader';
  }
  bearer() {
    const session = this.session();
    if (!session || session.expiresAt <= Date.now() + 5000) return '';
    return session.accessToken;
  }
  restore() {
    if (!this.config.browser) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as TokenSession | null;
      if (saved && typeof saved.accessToken === 'string' && saved.expiresAt > Date.now() + 5000) this.session.set(saved);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch { sessionStorage.removeItem(TOKEN_KEY); }
  }
  login(next = '/cotizar') { return this.beginAuthorization('/oauth2/authorize', next); }
  signup(next = '/catalogos') { return this.beginAuthorization('/signup', next); }
  private async beginAuthorization(endpoint: '/oauth2/authorize' | '/signup', next: string) {
    if (!this.config.browser) return;
    const config = this.config.settings().auth;
    if (!config) { this.error.set('El inicio de sesión todavía no está disponible.'); return; }
    this.clear();
    this.error.set('');
    this.busy.set(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const verifier = this.base64(bytes);
      const state = this.base64(crypto.getRandomValues(new Uint8Array(24)));
      const challenge = this.base64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      sessionStorage.setItem(FLOW_KEY, JSON.stringify({ verifier, state, next: safeReturnPath(next), createdAt: Date.now() }));
      const url = new URL(endpoint, config.domain);
      url.search = new URLSearchParams({ client_id: config.clientId, response_type: 'code', scope: 'openid profile', redirect_uri: config.redirectUri, code_challenge_method: 'S256', code_challenge: challenge, state }).toString();
      this.document.location.assign(url.toString());
    } catch { this.clear(); this.busy.set(false); this.error.set('No pudimos iniciar la sesión. Vuelve a intentarlo.'); }
  }
  async completeLogin(): Promise<string> {
    if (!this.config.browser) return '/cotizar';
    this.busy.set(true);
    this.error.set('');
    try {
      const config = this.config.settings().auth;
      const params = new URLSearchParams(location.search);
      const flow = JSON.parse(sessionStorage.getItem(FLOW_KEY) ?? 'null');
      sessionStorage.removeItem(FLOW_KEY);
      if (!config || !flow || params.get('state') !== flow.state || Date.now() - flow.createdAt > 10 * 60 * 1000 || !params.get('code') || params.has('error')) throw new Error('invalid-flow');
      history.replaceState(null, '', '/auth/callback');
      const response = await fetch(new URL('/oauth2/token', config.domain), {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, code: params.get('code')!, redirect_uri: config.redirectUri, code_verifier: flow.verifier }),
      });
      if (!response.ok) throw new Error('token-exchange');
      const tokens = await response.json();
      if (typeof tokens.access_token !== 'string' || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('invalid-token');
      const session = { accessToken: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session));
      this.session.set(session);
      return safeReturnPath(flow.next);
    } catch {
      this.clear();
      this.error.set('No pudimos validar el inicio de sesión. Inténtalo de nuevo.');
      throw new Error('No se completó el inicio de sesión.');
    } finally { this.busy.set(false); }
  }
  logout() {
    this.clear();
    const config = this.config.settings().auth;
    if (this.config.browser && config) {
      const url = new URL('/logout', config.domain);
      url.search = new URLSearchParams({ client_id: config.clientId, logout_uri: config.logoutUri }).toString();
      location.assign(url.toString());
    }
  }
  private clear() {
    this.session.set(undefined);
    if (this.config.browser) { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(FLOW_KEY); }
  }
  private base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
}

export function provideCotiTrama(): EnvironmentProviders {
  return makeEnvironmentProviders([provideAppInitializer(async () => {
    const config = inject(RuntimeConfig);
    const auth = inject(Auth);
    await config.load(); auth.restore();
  })]);
}
