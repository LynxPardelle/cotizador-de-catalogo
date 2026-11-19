import { conflict } from './errors.mjs';
import { hash } from './http.mjs';

export function createMemoryRepositories() {
  const catalogs = new Map();
  const quotes = new Map();
  const replay = new Map();
  const copy = value => value === undefined ? undefined : structuredClone(value);
  return {
    catalog: {
      async list(org) {
        const latest = new Map();
        for (const [key, catalog] of catalogs) if (key.startsWith(`${org}/`)) {
          if (!latest.has(catalog.catalogId) || latest.get(catalog.catalogId).version < catalog.version) latest.set(catalog.catalogId,catalog);
        }
        return copy([...latest.values()].sort((a,b)=>a.catalogId.localeCompare(b.catalogId)));
      },
      async get(org,id,version) { return copy(catalogs.get(`${org}/${id}/${version}`)); },
      async publish(org,catalog) {
        const key = `${org}/${catalog.catalogId}/${catalog.version}`;
        const existing = catalogs.get(key);
        if (existing) {
          if (hash(existing) !== hash(catalog)) throw conflict();
          return {catalog:copy(existing),created:false};
        }
        catalogs.set(key,copy(catalog));
        return {catalog:copy(catalog),created:true};
      },
    },
    quotes: {
      async get(org,id) { return copy(quotes.get(`${org}/${id}`)); },
      async findReplay(org,key,requestHash) {
        const existing = replay.get(`${org}/${hash(key)}`);
        if (!existing) return undefined;
        if (existing.requestHash !== requestHash) throw conflict();
        return copy(quotes.get(`${org}/${existing.quoteId}`));
      },
      async issue(org,key,requestHash,quote) {
        const replayKey = `${org}/${hash(key)}`;
        const existing = replay.get(replayKey);
        if (existing) {
          if (existing.requestHash !== requestHash) throw conflict();
          return {quote:copy(quotes.get(`${org}/${existing.quoteId}`)),created:false};
        }
        quotes.set(`${org}/${quote.quoteId}`,copy(quote));
        replay.set(replayKey,{requestHash,quoteId:quote.quoteId});
        return {quote:copy(quote),created:true};
      },
    },
  };
}
