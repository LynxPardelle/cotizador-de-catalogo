import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../core/auth';
import { WorkspaceContext } from '../../core/workspace-context';
import { CorrectionReason, PilotApi } from '../../data/pilot-api';
import { CorrectionReport } from './correction-report';
describe('Declared correction',()=>{
  it('retries the same frozen identifier and reason without changing a quote snapshot',async()=>{
    const bodies:{correctionId:string;reason:CorrectionReason}[]=[];
    const api={correction:async(quoteId:string,body:{correctionId:string;reason:CorrectionReason})=>{bodies.push(structuredClone(body));if(bodies.length===1)throw new Error('network');return {...body,quoteId,reportedAt:'2026-11-19T00:00:00Z'};}};
    TestBed.configureTestingModule({providers:[{provide:Auth,useValue:{available:true,role:'seller'}},{provide:WorkspaceContext,useValue:{activeOrganizationId:signal('org-a'),sessionVersion:signal(0)}},{provide:PilotApi,useValue:api}]});
    const fixture=TestBed.createComponent(CorrectionReport);fixture.componentRef.setInput('quoteId','q-immutable');fixture.detectChanges();TestBed.tick();
    const component=fixture.componentInstance as unknown as {submit:(event:Event)=>Promise<void>};await component.submit(new Event('submit'));fixture.detectChanges();expect(fixture.nativeElement.querySelector('select').disabled).toBe(true);
    await component.submit(new Event('submit'));fixture.detectChanges();expect(bodies).toHaveLength(2);expect(bodies[1]).toEqual(bodies[0]);expect(Object.keys(bodies[0]).sort()).toEqual(['correctionId','reason']);expect(fixture.nativeElement.textContent).toContain('la propuesta conserva sus importes');
  });
});
