import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsageContext, UsageMetric } from './usage-context';
import { WorkspaceContext } from './workspace-context';

const metric=(state:UsageMetric['state']='normal'):UsageMetric=>({used:state==='over'?3:state==='limit'?2:1,limit:2,remaining:state==='normal'||state==='warning'?1:0,state});
function answer(control:HttpTestingController,state:UsageMetric['state']='normal') {
  control.expectOne('/api/v1/team/usage').flush({plan:{id:'esencial',name:'Esencial',limits:{members:2,activeCatalogs:2,issuedQuotesPerMonth:100}},billingEnabled:false,limitsEnforced:true,members:metric(state)});
  control.expectOne('/api/v1/catalogs/usage').flush({planId:'esencial',activeCatalogs:metric()});
  control.expectOne('/api/v1/quotes/usage').flush({planId:'esencial',issuedQuotesPerMonth:metric(),period:{key:'2026-11',startsAt:'2026-11-01T00:00:00Z',resetsAt:'2026-12-01T00:00:00Z'}});
}
describe('UsageContext isolation',()=>{
  beforeEach(()=>TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]}));
  it('uses server threshold states for the three metrics and suppresses normal banners',async()=>{
    const workspace=TestBed.inject(WorkspaceContext);workspace.activeOrganizationId.set('org-a');
    const usage=TestBed.inject(UsageContext);const control=TestBed.inject(HttpTestingController);
    const load=usage.load();answer(control,'warning');await load;
    expect(usage.indicators()).toHaveLength(3);expect(usage.alerts()).toHaveLength(1);expect(usage.alerts()[0].metric.state).toBe('warning');
    expect(usage.data()?.billingEnabled).toBe(false);control.verify();
  });
  it('hides another organization immediately and ignores its pending response',async()=>{
    const workspace=TestBed.inject(WorkspaceContext);workspace.activeOrganizationId.set('org-a');
    const usage=TestBed.inject(UsageContext);const control=TestBed.inject(HttpTestingController);
    const old=usage.load();const requests=control.match(request=>request.url.endsWith('/usage'));
    workspace.activeOrganizationId.set('org-b');const current=usage.load();answer(control,'limit');await current;
    requests[0].flush({plan:{id:'old',name:'Old'},members:metric('over')});requests[1].flush({planId:'old',activeCatalogs:metric('over')});requests[2].flush({planId:'old',issuedQuotesPerMonth:metric('over'),period:{}});await old;
    expect(usage.data()?.plan.id).toBe('esencial');
    workspace.activeOrganizationId.set('org-c');expect(usage.data()).toBeUndefined();expect(usage.alerts()).toEqual([]);control.verify();
  });
  it('cannot restore quota data after logout even when the old request finishes',async()=>{
    const workspace=TestBed.inject(WorkspaceContext);workspace.activeOrganizationId.set('org-a');
    const usage=TestBed.inject(UsageContext);const control=TestBed.inject(HttpTestingController);
    const load=usage.load();workspace.reset();answer(control,'over');await load;
    expect(usage.data()).toBeUndefined();expect(usage.alerts()).toEqual([]);control.verify();
  });
  it('does not request or render account consumption during SSR',async()=>{
    TestBed.overrideProvider(PLATFORM_ID,{useValue:'server'});
    TestBed.inject(WorkspaceContext).activeOrganizationId.set('org-a');await TestBed.inject(UsageContext).load();
    TestBed.inject(HttpTestingController).expectNone(request=>request.url.endsWith('/usage'));
  });
  it('reads again after a mutation instead of reusing a pre-mutation request',async()=>{
    const workspace=TestBed.inject(WorkspaceContext);workspace.activeOrganizationId.set('org-a');
    const usage=TestBed.inject(UsageContext);const control=TestBed.inject(HttpTestingController);
    const old=usage.load();expect(usage.load()).toBe(old);
    const oldRequests=control.match(request=>request.url.endsWith('/usage'));
    const fresh=(usage as unknown as {refresh?:()=>Promise<void>}).refresh?.()??usage.load();
    const freshRequests=control.match(request=>request.url.endsWith('/usage'));
    expect(freshRequests).toHaveLength(3);
    const reply=(requests:typeof oldRequests,used:number)=>{
      requests[0].flush({plan:{id:'esencial',name:'Esencial'},billingEnabled:false,limitsEnforced:true,members:metric()});
      requests[1].flush({planId:'esencial',activeCatalogs:metric()});
      requests[2].flush({planId:'esencial',issuedQuotesPerMonth:{...metric(),used},period:{key:'2026-11',startsAt:'2026-11-01T00:00:00Z',resetsAt:'2026-12-01T00:00:00Z'}});
    };
    reply(oldRequests,1);await old;expect(usage.data()).toBeUndefined();
    reply(freshRequests,2);await fresh;expect(usage.data()?.issuedQuotesPerMonth.used).toBe(2);control.verify();
  });
  it('keeps a forced refresh error when an older successful response arrives later',async()=>{
    const workspace=TestBed.inject(WorkspaceContext);workspace.activeOrganizationId.set('org-a');
    const usage=TestBed.inject(UsageContext);const control=TestBed.inject(HttpTestingController);
    const old=usage.load();const requests=control.match(request=>request.url.endsWith('/usage'));
    const fresh=usage.refresh();
    control.expectOne('/api/v1/team/usage').flush({plan:{id:'esencial'},members:metric()});
    control.expectOne('/api/v1/catalogs/usage').flush({planId:'esencial',activeCatalogs:metric()});
    control.expectOne('/api/v1/quotes/usage').flush({error:{message:'El consumo no está disponible.'}},{status:503,statusText:'Unavailable'});await fresh;
    requests[0].flush({plan:{id:'esencial'},members:metric()});requests[1].flush({planId:'esencial',activeCatalogs:metric()});requests[2].flush({planId:'esencial',issuedQuotesPerMonth:metric(),period:{}});await old;
    expect(usage.error()).toBe('El consumo no está disponible.');expect(usage.data()).toBeUndefined();control.verify();
  });
});
