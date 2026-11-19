import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { apiMessage, CatalogApi } from '../../data/catalog-api';
import { Catalog, Preview, Quote, QuoteRequest } from '../../data/contracts';

interface QuoteState { catalogs: Catalog[]; preview: Preview | undefined; quote: Quote | undefined; request: QuoteRequest | undefined; key: string; busy: boolean; error: string; clock: number }

export const QuoteStore = signalStore(
  withState<QuoteState>(() => ({ catalogs: [], preview: undefined, quote: undefined, request: undefined, key: '', busy: false, error: '', clock: Date.now() })),
  withComputed((store) => ({ expired: computed(() => !!store.preview() && Date.parse(store.preview()!.validUntil) <= store.clock()) })),
  withMethods((store, api = inject(CatalogApi)) => {
    let generation = 0;
    return {
    async loadCatalogs() {
      patchState(store, { busy: true, error: '' });
      try { patchState(store, { catalogs: (await api.list()).catalogs }); } catch (error) { patchState(store, { error: apiMessage(error) }); }
      finally { patchState(store, { busy: false }); }
    },
    invalidate() { generation++; patchState(store, { preview: undefined, request: undefined, quote: undefined, key: '', error: '', busy: false }); },
    async calculate(request: QuoteRequest) {
      const current = ++generation;
      patchState(store, { busy: true, error: '', preview: undefined, quote: undefined, request: undefined, key: '' });
      try {
        const preview = await api.preview(request);
        if (current === generation) patchState(store, { preview, request: structuredClone(request), key: crypto.randomUUID() });
      } catch (error) { if (current === generation) patchState(store, { error: apiMessage(error) }); }
      finally { if (current === generation) patchState(store, { busy: false }); }
    },
    async issue() {
      if (!store.preview() || !store.request() || store.busy() || store.quote()) return;
      if (Date.parse(store.preview()!.validUntil) <= Date.now()) { patchState(store, { error: 'El catálogo ha vencido. Selecciona una versión vigente.' }); return; }
      patchState(store, { busy: true, error: '' });
      try { patchState(store, { quote: await api.issue(store.request()!, store.key()) }); }
      catch (error) { patchState(store, { error: apiMessage(error) }); }
      finally { patchState(store, { busy: false }); }
    },
    async open(id: string) {
      patchState(store, { busy: true, error: '', quote: undefined });
      try { patchState(store, { quote: await api.quote(id) }); }
      catch (error) { patchState(store, { error: apiMessage(error) }); }
      finally { patchState(store, { busy: false }); }
    },
  };
  }),
  withHooks({
    onInit(store) {
      if (isPlatformBrowser(inject(PLATFORM_ID))) {
        const timer = setInterval(() => patchState(store, { clock: Date.now() }), 1000);
        inject(DestroyRef).onDestroy(() => clearInterval(timer));
      }
    },
  }),
);
