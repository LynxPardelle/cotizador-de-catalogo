import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { apiMessage, CatalogApi } from '../../data/catalog-api';
import { Catalog } from '../../data/contracts';

export const CatalogStore = signalStore(
  withState({ catalogs: [] as Catalog[], busy: false, error: '', published: '' }),
  withMethods((store, api = inject(CatalogApi)) => {
    let publicationDocument = ''; let publicationKey = '';
    return {
      async load() {
        patchState(store, { busy: true, error: '' });
        try { patchState(store, { catalogs: (await api.list()).catalogs }); }
        catch (error) { patchState(store, { error: apiMessage(error) }); }
        finally { patchState(store, { busy: false }); }
      },
      async publish(document: string) {
        let catalog: Catalog;
        try {
          catalog = JSON.parse(document);
          if (!catalog || typeof catalog.catalogId !== 'string' || !Array.isArray(catalog.products)) throw new Error('catalog');
        } catch { patchState(store, { error: 'Revisa el documento: debe contener un catálogo JSON válido con productos.', published: '' }); return; }
        if (publicationDocument !== document) { publicationDocument = document; publicationKey = crypto.randomUUID(); }
        patchState(store, { busy: true, error: '', published: '' });
        try {
          await api.publish(catalog, publicationKey);
          patchState(store, { catalogs: (await api.list()).catalogs, published: `Publicamos ${catalog.name}, versión ${catalog.version}. Las propuestas anteriores conservan sus importes.` });
        } catch (error) { patchState(store, { error: apiMessage(error) }); }
        finally { patchState(store, { busy: false }); }
      },
    };
  }),
);
