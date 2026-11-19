import { TestBed } from '@angular/core/testing';
import { CatalogApi } from '../../data/catalog-api';
import { Preview, QuoteRequest } from '../../data/contracts';
import { QuoteStore } from './quote.store';
import { UsageContext } from '../../core/usage-context';
import { signal } from '@angular/core';
import { WorkspaceContext } from '../../core/workspace-context';
import { Auth } from '../../core/auth';
import { PILOT_CLOCK } from './pilot-tracker';

const request: QuoteRequest = { catalogId: 'oficina', version: 1, currency: 'MXN', items: [{ productId: 'desk', quantity: 1, optionIds: [] }] };
const preview: Preview = { catalogId: 'oficina', version: 1, currency: 'MXN', currencyExponent: 2, validUntil: '2099-12-31T23:59:59Z', subtotalMinor: '450000', totalMinor: '450000', lines: [{ productId: 'desk', name: 'Escritorio modular', quantity: 1, optionIds: [], unitPriceMinor: '450000', totalMinor: '450000' }], appliedRules: [] };

describe('QuoteStore', () => {
  let signedIn=signal(true);
  let workspace={activeOrganizationId:signal('org-a'),sessionVersion:signal(0)};
  beforeEach(() => {signedIn=signal(true);workspace={activeOrganizationId:signal('org-a'),sessionVersion:signal(0)};TestBed.configureTestingModule({ providers: [{provide:UsageContext,useValue:{load:async()=>{},refresh:async()=>{}}},{provide:WorkspaceContext,useValue:workspace},{provide:Auth,useValue:{get available(){return signedIn();}}}] });});
  it('marks an open preview expired when time advances without another action', async () => {
    vi.useFakeTimers();
    try {
      const api = { preview: async () => ({ ...preview, validUntil: new Date(Date.now() + 1500).toISOString() }) };
      TestBed.configureTestingModule({ providers: [QuoteStore, { provide: CatalogApi, useValue: api }] });
      const store = TestBed.inject(QuoteStore);
      await store.calculate(request);
      expect(store.expired()).toBe(false);
      vi.advanceTimersByTime(2000);
      expect(store.expired()).toBe(true);
    } finally { TestBed.resetTestingModule(); vi.useRealTimers(); }
  });

  it('discards a pending preview when the visible configuration changes', async () => {
    let resolve!: (value: Preview) => void;
    const api = { preview: () => new Promise<Preview>((done) => { resolve = done; }) };
    TestBed.configureTestingModule({ providers: [QuoteStore, { provide: CatalogApi, useValue: api }] });
    const store = TestBed.inject(QuoteStore);
    const pending = store.calculate(request);
    store.invalidate();
    resolve(preview);
    await pending;
    expect(store.preview()).toBeUndefined();
    expect(store.request()).toBeUndefined();
  });

  it('retries emission with the same key after a network failure', async () => {
    const keys: string[] = [];
    const api = { preview: async () => preview, issue: async (_: QuoteRequest, key: string) => { keys.push(key); if (keys.length === 1) throw new Error('network'); return { ...preview, quoteId: 'q-1', issuedAt: '2026-11-19T00:00:00Z', items: request.items }; } };
    TestBed.configureTestingModule({ providers: [QuoteStore, { provide: CatalogApi, useValue: api }] });
    const store = TestBed.inject(QuoteStore);
    await store.calculate(request);
    await store.issue();
    await store.issue();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(store.quote()?.quoteId).toBe('q-1');
  });

  it('cannot issue an expired catalogue preview', async () => {
    let issued = false;
    const api = { preview: async () => ({ ...preview, validUntil: '2000-01-01T00:00:00Z' }), issue: async () => { issued = true; } };
    TestBed.configureTestingModule({ providers: [QuoteStore, { provide: CatalogApi, useValue: api }] });
    const store = TestBed.inject(QuoteStore);
    await store.calculate(request);
    await store.issue();
    expect(issued).toBe(false);
    expect(store.error()).toContain('vencido');
  });

  it('retains the original request and key when a quota response is retried', async () => {
    const keys: string[]=[];
    const api={preview:async()=>preview,issue:async (_:QuoteRequest,key:string)=>{keys.push(key);if(keys.length===1)throw {status:409,error:{error:{code:'PLAN_LIMIT_REACHED',message:'El límite de propuestas del mes se alcanzó.'}}};return {...preview,quoteId:'existing-result',issuedAt:'2026-11-19T00:00:00Z',items:request.items};}};
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:api}]});
    const store=TestBed.inject(QuoteStore);await store.calculate(request);await store.issue();
    expect(store.errorCode()).toBe('PLAN_LIMIT_REACHED');expect(store.request()).toEqual(request);
    await store.issue();expect(keys[0]).toBe(keys[1]);expect(store.quote()?.quoteId).toBe('existing-result');
  });
  it.each(['logout','workspace'])('ignores a quote response that arrives after %s',async(change)=>{
    let finish!:(value:unknown)=>void;
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:{quote:()=>new Promise(resolve=>{finish=resolve;})}}]});
    const store=TestBed.inject(QuoteStore);const pending=store.open('private-q');
    if(change==='logout'){signedIn.set(false);workspace.sessionVersion.update(version=>version+1);workspace.activeOrganizationId.set('');}
    else workspace.activeOrganizationId.set('org-b');
    finish({...preview,quoteId:'private-q',issuedAt:'2026-11-19T00:00:00Z',items:request.items});await pending;
    expect(store.quote()).toBeUndefined();
  });
  it('ignores an issued proposal arriving after logout',async()=>{
    let finish!:(value:unknown)=>void;
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:{preview:async()=>preview,issue:()=>new Promise(resolve=>{finish=resolve;})}}]});
    const store=TestBed.inject(QuoteStore);await store.calculate(request);const pending=store.issue();
    signedIn.set(false);workspace.sessionVersion.update(version=>version+1);workspace.activeOrganizationId.set('');
    finish({...preview,quoteId:'private-issue',issuedAt:'2026-11-19T00:00:00Z',items:request.items});await pending;
    expect(store.quote()).toBeUndefined();
  });
  it('opens a fresh measurement when business content is edited after an issue failure',async()=>{
    let now=0;const bodies:QuoteRequest[]=[];
    const api={preview:async()=>preview,issue:async(body:QuoteRequest)=>{bodies.push(structuredClone(body));if(bodies.length===1)throw new Error('network');return {...preview,quoteId:'q-b',issuedAt:'2026-11-19T00:00:00Z',items:body.items,pilot:body.pilot};}};
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:api},{provide:PILOT_CLOCK,useValue:()=>now}]});
    const store=TestBed.inject(QuoteStore);await store.calculate(request);now=10000;await store.issue();
    const changed={...request,items:[{...request.items[0],quantity:2}]};now=20000;
    (store as unknown as {configurationEdited?:(value:QuoteRequest)=>void}).configurationEdited?.(changed);
    store.invalidate();now=30000;await store.calculate(changed);now=40000;await store.issue();
    expect(bodies[1].pilot?.flowId).not.toBe(bodies[0].pilot?.flowId);expect(bodies[1].pilot?.activeDurationMs).toBe(20000);expect(bodies[1].pilot?.adjustments).toBe(0);
  });
  it('freezes the pilot payload on the first issue attempt and reuses it on retry',async()=>{
    let now=0;const bodies:QuoteRequest[]=[];
    const api={preview:async()=>preview,issue:async(body:QuoteRequest)=>{bodies.push(structuredClone(body));if(bodies.length===1)throw new Error('network');return {...preview,quoteId:'q-retry',issuedAt:'2026-11-19T00:00:00Z',items:body.items};}};
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:api},{provide:PILOT_CLOCK,useValue:()=>now}]});
    const store=TestBed.inject(QuoteStore);await store.calculate(request);now=10000;await store.issue();now=90000;await store.issue();
    expect(bodies[1].pilot).toEqual(bodies[0].pilot);expect(bodies[0].pilot?.activeDurationMs).toBe(10000);
    expect(Object.keys(bodies[0].pilot!).sort()).toEqual(['activeDurationMs','adjustments','flowId']);
  });
  it('counts distinct successful previews and ignores failed or repeated configurations',async()=>{
    let attempts=0;let issued:QuoteRequest|undefined;
    const api={preview:async()=>{if(++attempts===2)throw new Error('preview failed');return preview;},issue:async(body:QuoteRequest)=>{issued=body;return {...preview,quoteId:'q-adjusted',issuedAt:'2026-11-19T00:00:00Z',items:body.items};}};
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:api}]});
    const store=TestBed.inject(QuoteStore);await store.calculate(request);const changed={...request,items:[{...request.items[0],quantity:2}]};await store.calculate(changed);await store.calculate(changed);await store.calculate(changed);await store.issue();
    expect(issued?.pilot?.adjustments).toBe(1);
  });
  it('preserves the first key and payload when an identical configuration is reviewed after a failed issue',async()=>{
    let now=0;const attempts:{body:QuoteRequest;key:string}[]=[];
    const api={preview:async()=>preview,issue:async(body:QuoteRequest,key:string)=>{attempts.push({body:structuredClone(body),key});if(attempts.length===1)throw new Error('response lost');return {...preview,quoteId:'same-q',issuedAt:'2026-11-19T00:00:00Z',items:body.items};}};
    TestBed.configureTestingModule({providers:[QuoteStore,{provide:CatalogApi,useValue:api},{provide:PILOT_CLOCK,useValue:()=>now}]});
    const store=TestBed.inject(QuoteStore);await store.calculate(request);now=10000;await store.issue();now=50000;await store.calculate(structuredClone(request));now=60000;await store.issue();
    expect(attempts[1]).toEqual(attempts[0]);
  });
});
