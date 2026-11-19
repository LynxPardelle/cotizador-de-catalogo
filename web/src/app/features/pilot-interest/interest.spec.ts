import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Auth } from '../../core/auth';
import { authInterceptor } from '../../core/auth.interceptor';
import { WorkspaceContext } from '../../core/workspace-context';
import { RuntimeConfig } from '../../core/runtime-config';

const valid={organizationName:'Organización sintética',contactEmail:'pilot@example.invalid',sector:'Mobiliario',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'not-sure',contactConsent:true};
const endpoint='/api/v1/pilot-interest';
function setup(browser=true){
  TestBed.configureTestingModule({providers:[provideRouter(routes),provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting(),{provide:Auth,useValue:{available:false,role:'reader',busy:()=>false,error:()=>'',bearer:()=> 'private-token'}},{provide:WorkspaceContext,useValue:{activeOrganizationId:signal('private-org'),sessionVersion:signal(0),memberships:signal([]),error:signal(''),busy:signal(false)}},...(browser?[]:[{provide:RuntimeConfig,useValue:{browser:false}}])]});
  return TestBed.inject(HttpTestingController);
}
function component(harness:RouterTestingHarness){return harness.routeDebugElement!.componentInstance as {model:{set:(value:typeof valid)=>void};submit:(event:Event)=>Promise<void>};}

describe('Public pilot interest',()=>{
  it('is discoverable from the public product page',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/');await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('a[href="/piloto/interes"]')).not.toBeNull();http.verify();
  });
  it('opens without an account and asks for explicit contact permission',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const page=harness.routeNativeElement!;
    expect(page.querySelector('h1')?.textContent).toContain('Participa en el piloto');
    expect(page.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(page.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
    expect(page.textContent).toContain('Enviar tu interés no confirma una plaza');
    expect(page.querySelector('input[type="password"]')).toBeNull();
    expect(page.querySelector('input[type="file"]')).toBeNull();
    http.verify();
  });

  it('never attaches a session token or organization selector to this public endpoint',()=>{
    const http=setup();TestBed.inject(HttpClient).post(endpoint,{}).subscribe();
    const request=http.expectOne(endpoint);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-Organization-Id')).toBe(false);
    request.flush({});http.verify();
  });

  it('requires valid fields and a checked contact permission before sending',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const form=component(harness);await form.submit(new Event('submit'));harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain('Revisa');
    form.model.set({...valid,contactEmail:'bad-address',contactConsent:false});harness.detectChanges();
    await form.submit(new Event('submit'));http.expectNone(endpoint);http.verify();
  });

  it('freezes the payload across an ambiguous retry and clears private fields after receipt',async()=>{
    const http=setup();const store=vi.spyOn(Storage.prototype,'setItem');const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const form=component(harness);form.model.set(valid);harness.detectChanges();
    const first=form.submit(new Event('submit'));const one=http.expectOne(endpoint);const body=structuredClone(one.request.body);
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);expect(body.privacyVersion).toBe('2026-11-19');
    expect(Object.keys(body).sort()).toEqual([...Object.keys(valid),'requestId','privacyVersion'].sort());
    one.error(new ProgressEvent('error'));await first;harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type="email"]')!.disabled).toBe(true);
    form.model.set({...valid,contactEmail:'other@example.invalid'});
    const second=form.submit(new Event('submit'));const two=http.expectOne(endpoint);expect(two.request.body).toEqual(body);
    two.flush({reference:body.requestId,status:'received'},{status:202,statusText:'Accepted'});await second;harness.detectChanges();
    const page=harness.routeNativeElement!;expect(page.textContent).toContain('Interés recibido');expect(page.textContent).toContain(body.requestId);
    expect(page.textContent).not.toContain(valid.contactEmail);expect(page.querySelector('form')).toBeNull();expect(store).not.toHaveBeenCalled();
    store.mockRestore();http.verify();
  });

  it('does not present an unrelated or malformed receipt as a successful submission',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const form=component(harness);form.model.set(valid);harness.detectChanges();const operation=form.submit(new Event('submit'));const request=http.expectOne(endpoint);
    request.flush({reference:'another-reference',status:'received'},{status:202,statusText:'Accepted'});await operation;harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).not.toContain('Interés recibido');expect(harness.routeNativeElement!.textContent).toContain('Reintentar envío');http.verify();
  });

  it('keeps a rate-limited submission available for a safe retry without claiming contact or admission',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const form=component(harness);form.model.set(valid);harness.detectChanges();const operation=form.submit(new Event('submit'));const request=http.expectOne(endpoint);
    request.flush({error:{code:'INTEREST_LIMIT_REACHED'}},{status:429,statusText:'Too Many Requests'});await operation;harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain('más tarde');expect(harness.routeNativeElement!.textContent).not.toContain('Interés recibido');http.verify();
  });

  it('keeps submission browser-only and renders no contact in the initial HTML',async()=>{
    const http=setup(false);
    const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.innerHTML).not.toContain(valid.contactEmail);
    const form=component(harness);form.model.set(valid);harness.detectChanges();await form.submit(new Event('submit'));http.expectNone(endpoint);http.verify();
  });

  it('allows correction after a definitive validation rejection before any ambiguous response',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const form=component(harness);form.model.set(valid);harness.detectChanges();const operation=form.submit(new Event('submit'));const request=http.expectOne(endpoint);const firstId=request.request.body.requestId;
    request.flush({error:{code:'INVALID_REQUEST'}},{status:400,statusText:'Bad Request'});await operation;harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type="email"]')!.disabled).toBe(false);
    form.model.set({...valid,sector:'Productos modulares'});harness.detectChanges();const next=form.submit(new Event('submit'));const corrected=http.expectOne(endpoint);expect(corrected.request.body.requestId).not.toBe(firstId);expect(corrected.request.body.sector).toBe('Productos modulares');corrected.flush({reference:corrected.request.body.requestId,status:'received'});await next;http.verify();
  });

  it('does not unlock a previously ambiguous payload after a later validation rejection',async()=>{
    const http=setup();const harness=await RouterTestingHarness.create('/piloto/interes');await harness.fixture.whenStable();
    const form=component(harness);form.model.set(valid);harness.detectChanges();const first=form.submit(new Event('submit'));const request=http.expectOne(endpoint);request.error(new ProgressEvent('error'));await first;
    const second=form.submit(new Event('submit'));const retry=http.expectOne(endpoint);retry.flush({error:{code:'INVALID_REQUEST'}},{status:400,statusText:'Bad Request'});await second;harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type="email"]')!.disabled).toBe(true);http.verify();
  });
});
