import { TestBed } from '@angular/core/testing';
import { CatalogApi } from '../../data/catalog-api';
import { Preview, QuoteRequest } from '../../data/contracts';
import { QuoteStore } from './quote.store';

const request: QuoteRequest = { catalogId: 'oficina', version: 1, currency: 'MXN', items: [{ productId: 'desk', quantity: 1, optionIds: [] }] };
const preview: Preview = { catalogId: 'oficina', version: 1, currency: 'MXN', currencyExponent: 2, validUntil: '2099-12-31T23:59:59Z', subtotalMinor: '450000', totalMinor: '450000', lines: [{ productId: 'desk', name: 'Escritorio modular', quantity: 1, optionIds: [], unitPriceMinor: '450000', totalMinor: '450000' }], appliedRules: [] };

describe('QuoteStore', () => {
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
});
