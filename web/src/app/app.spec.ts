import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { RuntimeConfig } from './core/runtime-config';
import { CatalogApi } from './data/catalog-api';
import { Catalog } from './data/contracts';
import { Auth } from './core/auth';

describe('CotiTrama', () => {
  it('opens a branded workspace with accessible product navigation', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient()] });
    const harness = await RouterTestingHarness.create('/');
    const page = harness.routeNativeElement;

    expect(page?.textContent ?? '').toContain('CotiTrama');
    expect(page?.querySelector('nav[aria-label="Principal"]')).not.toBeNull();
  });

  it('serves a public landing with clear plan status and a working registration action', async () => {
    const signup = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), { provide: Auth, useValue: { available: false, busy: () => false, error: () => '', signup, login: vi.fn() } }] });
    const harness = await RouterTestingHarness.create('/');
    const page = harness.routeNativeElement!;
    expect(page.querySelector('h1')?.textContent).toContain('Cotiza con reglas claras');
    expect(page.textContent).toContain('Esencial');
    expect(page.textContent).toContain('Equipo');
    expect(page.textContent).toContain('Empresa');
    expect(page.textContent).toContain('en validación');
    page.querySelector<HTMLButtonElement>('[data-testid="hero-signup"]')!.click();
    expect(signup).toHaveBeenCalledWith('/catalogos');
  });

  it('keeps the demo entry available only when this environment enables it', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient()] });
    const config = TestBed.inject(RuntimeConfig);
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement!.querySelector('[data-testid="explore-demo"]')).toBeNull();
    config.settings.set({ productName: 'CotiTrama', demo: true });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[data-testid="explore-demo"]')?.getAttribute('href')).toBe('/cotizar');
  });

  it('publishes the synthetic example with explicit compatibility rules', async () => {
    let published: Catalog | undefined;
    const api = { list: async () => ({ catalogs: [] }), publish: async (catalog: Catalog) => { published = catalog; return catalog; } };
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), { provide: CatalogApi, useValue: api }] });
    TestBed.inject(RuntimeConfig).settings.set({ productName: 'CotiTrama', demo: true });
    const harness = await RouterTestingHarness.create('/catalogos');
    await harness.fixture.whenStable();
    const button = harness.routeNativeElement?.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button).not.toBeNull();
    button!.click();
    await harness.fixture.whenStable();
    expect(published?.products[0].incompatibleOptions).toEqual([]);
  });
});
