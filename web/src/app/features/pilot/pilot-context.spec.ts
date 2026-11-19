import { signal, PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../core/auth';
import { WorkspaceContext } from '../../core/workspace-context';
import { PilotContext } from './pilot-context';
import { sampleMetrics } from './pilot.fixture';
describe('Pilot metrics scope',()=>{
  let role=signal('admin');let signedIn=signal(true);
  beforeEach(()=>{role=signal('admin');signedIn=signal(true);TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:Auth,useValue:{get available(){return signedIn();},get role(){return role();}}}]});TestBed.inject(WorkspaceContext).activeOrganizationId.set('org-a');});
  it.each(['reader','seller'])('does not request metrics for %s',async(value)=>{role.set(value);await TestBed.inject(PilotContext).load();TestBed.inject(HttpTestingController).expectNone(request=>request.url.includes('/metrics'));});
  it('ignores a late response and hides prior data when the workspace changes',async()=>{const context=TestBed.inject(PilotContext);const control=TestBed.inject(HttpTestingController);const pending=context.load(7);const request=control.expectOne(req=>req.url==='/api/v1/quotes/metrics'&&req.params.get('days')==='7');TestBed.inject(WorkspaceContext).activeOrganizationId.set('org-b');request.flush(sampleMetrics);await pending;expect(context.data()).toBeUndefined();control.verify();});
  it('does not retain a privileged result after the role is removed',async()=>{const context=TestBed.inject(PilotContext);const control=TestBed.inject(HttpTestingController);const pending=context.load();control.expectOne(request=>request.url.includes('/metrics')).flush(sampleMetrics);await pending;expect(context.data()?.totalIssued).toBe(3);role.set('seller');expect(context.data()).toBeUndefined();});
  it('makes no metrics request during SSR',async()=>{TestBed.resetTestingModule();TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:PLATFORM_ID,useValue:'server'},{provide:Auth,useValue:{available:true,role:'admin'}}]});TestBed.inject(WorkspaceContext).activeOrganizationId.set('org-a');await TestBed.inject(PilotContext).load();TestBed.inject(HttpTestingController).expectNone(request=>request.url.includes('/metrics'));});
});
