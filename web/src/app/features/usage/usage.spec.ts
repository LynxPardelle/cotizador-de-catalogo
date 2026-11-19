import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/auth';
import { UsageContext, UsageMetric } from '../../core/usage-context';
import { WorkspaceContext } from '../../core/workspace-context';
import { Usage } from './usage';

const cases: {state:UsageMetric['state'];used:number;label:string}[]=[{state:'normal',used:1,label:''},{state:'warning',used:8,label:'Cerca del límite'},{state:'limit',used:10,label:'Límite alcanzado'},{state:'over',used:12,label:'Por encima del límite'}];
describe('Consumption presentation',()=>{
  it.each(cases)('presents $state usage without enabling billing',async({state,used,label})=>{
    TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting(),{provide:Auth,useValue:{available:true}}]});
    TestBed.inject(WorkspaceContext).activeOrganizationId.set('org-a');
    const fixture=TestBed.createComponent(Usage);fixture.detectChanges();TestBed.tick();
    const pending=TestBed.inject(UsageContext).load();
    const control=TestBed.inject(HttpTestingController);const current={used,limit:10,remaining:Math.max(0,10-used),state};const normal={used:1,limit:10,remaining:9,state:'normal'};
    control.expectOne('/api/v1/team/usage').flush({plan:{id:'equipo',name:'Equipo',limits:{members:10,activeCatalogs:10,issuedQuotesPerMonth:100}},billingEnabled:false,limitsEnforced:true,members:current});
    control.expectOne('/api/v1/catalogs/usage').flush({planId:'equipo',activeCatalogs:normal});
    control.expectOne('/api/v1/quotes/usage').flush({planId:'equipo',issuedQuotesPerMonth:normal,period:{key:'2026-11',startsAt:'2026-11-01T00:00:00Z',resetsAt:'2026-12-01T00:00:00Z'}});
    await pending;await fixture.whenStable();fixture.detectChanges();
    const page=fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('.usage-indicator')).toHaveLength(3);
    expect(page.textContent).toContain('Equipo');expect(page.textContent).toContain('01/12/2026 00:00');expect(page.textContent).toContain('sin cargos');
    if(label)expect(page.textContent).toContain(label);else expect(page.querySelector('.usage-state')).toBeNull();
    expect(page.querySelector('a[href*="checkout"]')).toBeNull();control.verify();
  });
});
