import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { RuntimeConfig } from './core/runtime-config';
import { CatalogApi } from './data/catalog-api';
import { Catalog } from './data/contracts';
import { Auth } from './core/auth';
import proposal from '../../../services/shared/plans.json';
import { money } from './data/money';
import { TeamApi } from './data/team-api';
import { WorkspaceContext } from './core/workspace-context';
import { Router } from '@angular/router';
import { UsageContext } from './core/usage-context';

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

  it('presents the shared price proposal without offering checkout', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient()] });
    const harness = await RouterTestingHarness.create('/');
    const page = harness.routeNativeElement!;
    const prices = [...page.querySelectorAll('.plan-price')].map((element) => element.textContent ?? '');
    expect(prices).toEqual(proposal.plans.map((plan) => money(plan.priceMinor, proposal.currency, 2)));
    expect(page.textContent).toContain('Precio propuesto');
    expect(page.textContent).toContain('antes de impuestos');
    expect(page.querySelector('a[href*="checkout.stripe"]')).toBeNull();
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

  it('shows team access rules without exposing member controls to a reader', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), { provide: Auth, useValue: { available: true, role: 'reader', busy: () => false, error: () => '', logout: vi.fn() } }] });
    const harness = await RouterTestingHarness.create('/equipo');
    const page = harness.routeNativeElement!;
    expect(page.querySelector('h1')?.textContent).toContain('Equipo');
    expect(page.textContent).toContain('Solo los administradores');
    expect(page.querySelector('input[type="email"]')).toBeNull();
  });

  it('keeps an invitation token out of the rendered page before authentication', async () => {
    const login = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), { provide: Auth, useValue: { available: false, role: 'reader', busy: () => false, error: () => '', login, signup: vi.fn() } }] });
    const token = 'private-invitation-token';
    const harness = await RouterTestingHarness.create(`/invitacion/${token}`);
    const page = harness.routeNativeElement!;
    expect(page.querySelector('h1')?.textContent).toContain('invitación');
    expect(page.textContent).not.toContain(token);
    page.querySelector<HTMLButtonElement>('[data-testid="invitation-login"]')!.click();
    expect(login).toHaveBeenCalledWith(`/invitacion/${token}`);
  });

  it('accepts an invitation and opens the joined organization without changing accounts', async () => {
    TestBed.configureTestingModule({providers:[{provide:UsageContext,useValue:{load:async()=>{},refresh:async()=>{},reset:()=>{},alerts:()=>[]}}]});
    const accept = vi.fn(async () => ({ membership: { organizationId: 'joined-org', role: 'seller' } }));
    const team = { invitation: async () => ({ invitation: { organizationId: 'joined-org', email: 'person@example.com', role: 'seller', expiresAt: '2099-01-01T00:00:00Z' } }), accept };
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), { provide: Auth, useValue: { available: true, role: 'seller', busy: () => false, error: () => '', logout: vi.fn() } }, { provide: TeamApi, useValue: team }, { provide: CatalogApi, useValue: { list: async () => ({ catalogs: [] }) } }] });
    const workspace = TestBed.inject(WorkspaceContext);
    workspace.memberships.set([{ organizationId: 'own-org', role: 'admin' }]);
    workspace.activeOrganizationId.set('own-org');
    const load = vi.spyOn(workspace, 'load').mockImplementation(async (preferred) => {
      workspace.memberships.set([{ organizationId: 'own-org', role: 'admin' }, { organizationId: 'joined-org', role: 'seller' }]);
      workspace.activeOrganizationId.set(preferred!);
    });
    const harness = await RouterTestingHarness.create('/invitacion/recipient-only-token');
    await harness.fixture.whenStable();
    const page = harness.routeNativeElement!;
    const button = [...page.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent?.includes('Aceptar invitación'));
    expect(page.textContent).toContain('person@example.com');
    button!.click();
    await harness.fixture.whenStable();
    expect(accept).toHaveBeenCalledWith('recipient-only-token');
    expect(load).toHaveBeenCalledWith('joined-org');
    expect(TestBed.inject(Router).url).toBe('/cotizar');
    const selector = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#active-workspace')!;
    expect([...selector.options].map((option) => option.value)).toEqual(['own-org', 'joined-org']);
    expect(selector.value).toBe('joined-org');
    expect(selector.selectedOptions[0].textContent).toContain('Vendedor');
  });

  it('explains an expired invitation without showing an acceptance action', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), { provide: Auth, useValue: { available: true, role: 'reader', busy: () => false, error: () => '', logout: vi.fn() } }, { provide: TeamApi, useValue: { invitation: async () => { throw { status: 410 }; } } }] });
    const harness = await RouterTestingHarness.create('/invitacion/expired-token');
    await harness.fixture.whenStable();
    const page = harness.routeNativeElement!;
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('ha caducado');
    expect([...page.querySelectorAll('button')].some((element) => element.textContent?.includes('Aceptar invitación'))).toBe(false);
  });

  it('offers an authenticated consumption route without a checkout action', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient()] });
    const harness = await RouterTestingHarness.create('/consumo');
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toContain('Consumo');
    expect(harness.routeNativeElement!.textContent).toContain('Inicia sesión');
    expect(harness.routeNativeElement!.querySelector('a[href*="checkout"]')).toBeNull();
  });

  it('archives a catalogue only after confirmation and keeps its history visible',async()=>{
    const catalog:Catalog={catalogId:'first',name:'Primer catálogo',version:1,currency:'MXN',currencyExponent:2,rounding:'half-up',validUntil:'2099-01-01T00:00:00Z',products:[{id:'desk',name:'Escritorio',basePriceMinor:'10000',options:[],incompatibleOptions:[]}],rules:[]};
    let archived=false;const status=vi.fn(async(_id:string,active:boolean)=>{archived=!active;return {catalogId:'first',active};});
    const api={list:async()=>({catalogs:archived?[]:[catalog],archivedCatalogs:archived?[catalog]:[]}),status};
    TestBed.configureTestingModule({providers:[provideRouter(routes),provideHttpClient(),{provide:Auth,useValue:{available:true,role:'admin',busy:()=>false,error:()=>'',logout:vi.fn()}},{provide:CatalogApi,useValue:api}]});
    const harness=await RouterTestingHarness.create('/catalogos');await harness.fixture.whenStable();
    const page=harness.routeNativeElement!;
    [...page.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim()==='Archivar')!.click();await harness.fixture.whenStable();
    expect(status).not.toHaveBeenCalled();
    [...page.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim()==='Sí, archivar')!.click();await harness.fixture.whenStable();
    expect(status).toHaveBeenCalledWith('first',false);expect(page.textContent).toContain('Catálogos archivados');expect(page.textContent).toContain('Sus versiones y propuestas se conservan');
  });
});
