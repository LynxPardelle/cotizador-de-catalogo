import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { apiCode, apiMessage, CatalogApi } from '../../data/catalog-api';
import { Catalog, Preview, Quote, QuoteRequest } from '../../data/contracts';
import { UsageContext } from '../../core/usage-context';
import { WorkspaceContext } from '../../core/workspace-context';
import { Auth } from '../../core/auth';

interface QuoteState { catalogs: Catalog[]; preview: Preview | undefined; quote: Quote | undefined; request: QuoteRequest | undefined; key: string; busy: boolean; error: string; errorCode: string; clock: number }

export const QuoteStore = signalStore(
  withState<QuoteState>(() => ({ catalogs: [], preview: undefined, quote: undefined, request: undefined, key: '', busy: false, error: '', errorCode: '', clock: Date.now() })),
  withComputed((store) => ({ expired: computed(() => !!store.preview() && Date.parse(store.preview()!.validUntil) <= store.clock()) })),
  withMethods((store, api = inject(CatalogApi), usage = inject(UsageContext), workspace = inject(WorkspaceContext), auth = inject(Auth)) => {
    let generation = 0;
    const scopeKey = () => `${workspace.sessionVersion()}:${workspace.activeOrganizationId()}`;
    const currentScope = (scope: string) => auth.available && scopeKey() === scope;
    return {
    async loadCatalogs() {
      patchState(store, { busy: true, error: '' });
      try { patchState(store, { catalogs: (await api.list()).catalogs }); } catch (error) { patchState(store, { error: apiMessage(error) }); }
      finally { patchState(store, { busy: false }); }
    },
    invalidate() { generation++; patchState(store, { preview: undefined, request: undefined, quote: undefined, key: '', error: '', errorCode: '', busy: false }); },
    async calculate(request: QuoteRequest) {
      const current = ++generation;
      const scope = scopeKey();
      patchState(store, { busy: true, error: '', errorCode: '', preview: undefined, quote: undefined, request: undefined, key: '' });
      try {
        const preview = await api.preview(request);
        if (current === generation && currentScope(scope)) patchState(store, { preview, request: structuredClone(request), key: crypto.randomUUID() });
      } catch (error) { if (current === generation && currentScope(scope)) patchState(store, { error: apiMessage(error) }); }
      finally { if (current === generation) patchState(store, { busy: false }); }
    },
    async issue() {
      if (!auth.available || !store.preview() || !store.request() || store.busy() || store.quote()) return;
      if (Date.parse(store.preview()!.validUntil) <= Date.now()) { patchState(store, { error: 'El catálogo ha vencido. Selecciona una versión vigente.' }); return; }
      patchState(store, { busy: true, error: '', errorCode: '' });
      const current = ++generation; const scope = scopeKey();
      try { const quote = await api.issue(store.request()!, store.key()); if (current === generation && currentScope(scope)) { patchState(store, { quote }); void usage.refresh(); } }
      catch (error) { if (current === generation && currentScope(scope)) { patchState(store, { error: apiMessage(error), errorCode: apiCode(error) }); if (apiCode(error) === 'PLAN_LIMIT_REACHED') void usage.refresh(); } }
      finally { if (current === generation) patchState(store, { busy: false }); }
    },
    async open(id: string) {
      patchState(store, { busy: true, error: '', quote: undefined });
      const current = ++generation; const scope = scopeKey();
      try { if (!auth.available) return; const quote = await api.quote(id); if (current === generation && currentScope(scope)) patchState(store, { quote }); }
      catch (error) { if (current === generation && currentScope(scope)) patchState(store, { error: apiMessage(error) }); }
      finally { if (current === generation) patchState(store, { busy: false }); }
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
