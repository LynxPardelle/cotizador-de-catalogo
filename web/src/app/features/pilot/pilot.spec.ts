import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../../core/auth';
import { UsageContext } from '../../core/usage-context';
import { WorkspaceContext } from '../../core/workspace-context';
import { PilotContext } from './pilot-context';
import { Pilot } from './pilot';
import { sampleMetrics } from './pilot.fixture';
describe('Pilot evidence presentation',()=>{
  it('presents sample coverage and keeps declared corrections distinct from adjustments',async()=>{
    const signedIn=signal(true);const data=signal(sampleMetrics);
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:Auth,useValue:{get available(){return signedIn();},role:'admin',login:vi.fn()}},{provide:WorkspaceContext,useValue:{activeOrganizationId:signal('org-a'),sessionVersion:signal(0)}},{provide:UsageContext,useValue:{data:()=>undefined,load:async()=>{}}},{provide:PilotContext,useValue:{data,busy:()=>false,error:()=>'',load:async()=>{},reset:()=>{}}}]});
    const fixture=TestBed.createComponent(Pilot);fixture.detectChanges();await fixture.whenStable();
    const page=fixture.nativeElement as HTMLElement;expect(page.textContent).toContain('Muestra: 2 de 3');expect(page.textContent).toContain('1 min 30 s');expect(page.textContent).toContain('Correcciones declaradas');expect(page.textContent).toContain('No representa ahorro');
    signedIn.set(false);fixture.detectChanges();expect(page.textContent).toContain('Inicia sesión');expect(page.querySelector('.pilot-summary')).toBeNull();
  });
});
