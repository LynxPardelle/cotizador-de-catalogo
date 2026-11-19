import { TestBed } from '@angular/core/testing';
import { CatalogApi } from '../../data/catalog-api';
import { Preview, QuoteRequest } from '../../data/contracts';
import { QuoteStore } from './quote.store';
import { UsageContext } from '../../core/usage-context';
import { signal } from '@angular/core';
import { WorkspaceContext } from '../../core/workspace-context';
import { Auth } from '../../core/auth';

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
});
