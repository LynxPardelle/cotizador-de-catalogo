import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { apiCode, apiMessage, CatalogApi } from '../../data/catalog-api';
import { Catalog } from '../../data/contracts';
import { UsageContext } from '../../core/usage-context';

export const CatalogStore = signalStore(
  withState({ catalogs: [] as Catalog[], archivedCatalogs: [] as Catalog[], busy: false, error: '', errorCode: '', published: '' }),
  withMethods((store, api = inject(CatalogApi), usage = inject(UsageContext)) => {
    let publicationDocument = ''; let publicationKey = '';
    async function refresh() { const result = await api.list(); patchState(store, { catalogs: result.catalogs, archivedCatalogs: result.archivedCatalogs ?? [] }); }
    return {
      async load() {
        patchState(store, { busy: true, error: '', errorCode: '' });
        try { await refresh(); }
        catch (error) { patchState(store, { error: apiMessage(error), errorCode: apiCode(error) }); }
        finally { patchState(store, { busy: false }); }
      },
      async publish(document: string) {
        let catalog: Catalog;
        try {
          catalog = JSON.parse(document);
          if (!catalog || typeof catalog.catalogId !== 'string' || !Array.isArray(catalog.products)) throw new Error('catalog');
        } catch { patchState(store, { error: 'Revisa el documento: debe contener un catálogo JSON válido con productos.', published: '' }); return; }
        if (publicationDocument !== document) { publicationDocument = document; publicationKey = crypto.randomUUID(); }
        patchState(store, { busy: true, error: '', errorCode: '', published: '' });
        try {
          await api.publish(catalog, publicationKey);
          void usage.refresh(); await refresh();
          patchState(store, { published: `Publicamos ${catalog.name}, versión ${catalog.version}. Las propuestas anteriores conservan sus importes.` });
        } catch (error) { patchState(store, { error: apiMessage(error), errorCode: apiCode(error) }); if (apiCode(error) === 'PLAN_LIMIT_REACHED') void usage.refresh(); }
        finally { patchState(store, { busy: false }); }
      },
      async setActive(catalogId: string, active: boolean) {
        if (store.busy()) return;
        patchState(store, { busy: true, error: '', errorCode: '', published: '' });
        try { await api.status(catalogId, active); void usage.refresh(); await refresh(); patchState(store, { published: active ? 'Catálogo reactivado. Ya puedes usarlo para nuevas propuestas.' : 'Catálogo archivado. Sus versiones y propuestas se conservan.' }); }
        catch (error) { patchState(store, { error: apiMessage(error), errorCode: apiCode(error) }); if (apiCode(error) === 'PLAN_LIMIT_REACHED') void usage.refresh(); }
        finally { patchState(store, { busy: false }); }
      },
    };
  }),
);
