import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth, safeReturnPath } from './auth';
import { authInterceptor } from './auth.interceptor';
import { RuntimeConfig } from './runtime-config';
import { DOCUMENT } from '@angular/common';
import { WorkspaceContext } from './workspace-context';

describe('authentication boundaries', () => {
  it('starts registration with a fresh PKCE state and the existing callback contract', async () => {
    const assign = vi.fn();
    const browserCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto), subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });
    try {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: DOCUMENT, useValue: { location: { assign } } }] });
      TestBed.inject(RuntimeConfig).settings.set({ productName: 'CotiTrama', demo: false, auth: { domain: 'https://auth.example', clientId: 'client', redirectUri: 'https://app.example/auth/callback', logoutUri: 'https://app.example' } });
      const auth = TestBed.inject(Auth);
      sessionStorage.setItem('cotitrama.pkce', JSON.stringify({ state: 'stale' }));
      await (auth as unknown as { signup?: (path: string) => Promise<void> }).signup?.('/catalogos');
      expect(assign).toHaveBeenCalledOnce();
      const url = new URL(assign.mock.calls[0][0]);
      expect(url.pathname).toBe('/signup');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/auth/callback');
      const flow = JSON.parse(sessionStorage.getItem('cotitrama.pkce')!);
      expect(flow.state).not.toBe('stale');
      expect(url.searchParams.get('state')).toBe(flow.state);
      expect(flow.verifier).toHaveLength(43);
      expect(flow.next).toBe('/catalogos');
    } finally { sessionStorage.clear(); vi.unstubAllGlobals(); }
  });
  it('rejects external or callback return paths', () => {
    expect(safeReturnPath('//attacker.example')).toBe('/cotizar');
    expect(safeReturnPath('/\\attacker.example')).toBe('/cotizar');
    expect(safeReturnPath('/auth/callback?code=secret')).toBe('/cotizar');
    expect(safeReturnPath('/propuestas/q-1')).toBe('/propuestas/q-1');
  });

  it('exchanges a registration callback once and cannot reuse its code or verifier', async () => {
    const exchange = vi.fn(async () => ({ ok: true, json: async () => ({ access_token: 'opaque-access-token', expires_in: 900 }) }));
    vi.stubGlobal('fetch', exchange);
    try {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: WorkspaceContext, useValue: { load: async () => {}, reset: () => {}, role: () => 'reader' } }] });
      TestBed.inject(RuntimeConfig).settings.set({ productName: 'CotiTrama', demo: false, auth: { domain: 'https://auth.example', clientId: 'client', redirectUri: 'https://app.example/auth/callback', logoutUri: 'https://app.example' } });
      sessionStorage.setItem('cotitrama.pkce', JSON.stringify({ state: 'new-state', verifier: 'original-verifier', next: '/catalogos', createdAt: Date.now() }));
      history.replaceState(null, '', '/auth/callback?code=single-use-code&state=new-state');
      const auth = TestBed.inject(Auth);
      expect(await auth.completeLogin()).toBe('/catalogos');
      expect(auth.bearer()).toBe('opaque-access-token');
      expect(sessionStorage.getItem('cotitrama.pkce')).toBeNull();
      expect(location.search).toBe('');
      const request = exchange.mock.calls[0] as unknown as [URL, RequestInit];
      expect(new URLSearchParams(request[1].body as URLSearchParams).get('code_verifier')).toBe('original-verifier');
      history.replaceState(null, '', '/auth/callback?code=single-use-code&state=new-state');
      await expect(auth.completeLogin()).rejects.toThrow('No se completó');
      expect(exchange).toHaveBeenCalledOnce();
    } finally { history.replaceState(null, '', '/'); sessionStorage.clear(); vi.unstubAllGlobals(); }
  });

  it('does not restore an expired session', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    sessionStorage.setItem('cotitrama.session', JSON.stringify({ accessToken: 'expired', expiresAt: Date.now() - 1000 }));
    const auth = TestBed.inject(Auth);
    auth.restore();
    expect(auth.bearer()).toBe('');
    expect(sessionStorage.getItem('cotitrama.session')).toBeNull();
  });

  it('rejects an unsolicited OAuth callback and clears saved credentials', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    TestBed.inject(RuntimeConfig).settings.set({ productName: 'CotiTrama', demo: false, auth: { domain: 'https://auth.example', clientId: 'client', redirectUri: 'https://app.example/auth/callback', logoutUri: 'https://app.example' } });
    sessionStorage.setItem('cotitrama.session', JSON.stringify({ accessToken: 'old', expiresAt: Date.now() + 60000 }));
    const auth = TestBed.inject(Auth);
    auth.restore();
    await expect(auth.completeLogin()).rejects.toThrow('No se completó');
    expect(auth.bearer()).toBe('');
    expect(sessionStorage.getItem('cotitrama.pkce')).toBeNull();
  });

  it('attaches a bearer token only to this product business API', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), { provide: Auth, useValue: { bearer: () => 'test-token' } }] });
    const workspace = TestBed.inject(WorkspaceContext);
    workspace.memberships.set([{ organizationId: 'org-a', role: 'seller' }]);
    workspace.select('org-a');
    const http = TestBed.inject(HttpClient); const control = TestBed.inject(HttpTestingController);
    http.get('/api/v1/catalogs').subscribe();
    const business = control.expectOne('/api/v1/catalogs');
    expect(business.request.headers.get('Authorization')).toBe('Bearer test-token'); business.flush({ catalogs: [] });
    expect(business.request.headers.get('X-Organization-Id')).toBe('org-a');
    http.get('https://outside.example/api/v1/catalogs').subscribe();
    const external = control.expectOne('https://outside.example/api/v1/catalogs');
    expect(external.request.headers.has('Authorization')).toBe(false);
    expect(external.request.headers.has('X-Organization-Id')).toBe(false); external.flush({});
    control.verify();
  });
});
