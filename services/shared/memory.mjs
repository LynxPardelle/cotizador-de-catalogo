import { conflict, notFound } from './errors.mjs';
import { hash } from './http.mjs';
import { quotaExceeded, usageMetric, monthlyPeriod } from './quota.mjs';

export function createMemoryRepositories() {
  const catalogs = new Map();
  const quotes = new Map();
  const replay = new Map();
  const catalogHeads = new Map();
  const copy = value => value === undefined ? undefined : structuredClone(value);
  const listing = org => {
    const latest=new Map();
    for(const [key,catalog] of catalogs) if(key.startsWith(`${org}/`) && (!latest.has(catalog.catalogId) || latest.get(catalog.catalogId).version<catalog.version)) latest.set(catalog.catalogId,catalog);
    const result={catalogs:[],archivedCatalogs:[]};
    for(const catalog of [...latest.values()].sort((a,b)=>a.catalogId.localeCompare(b.catalogId))) result[catalogHeads.get(`${org}/${catalog.catalogId}`)?.active===false ? 'archivedCatalogs' : 'catalogs'].push(catalog);
    return result;
  };
  const catalogUsed=org=>listing(org).catalogs.length;
  const quoteUsed=(org,period)=>[...quotes].filter(([key,quote])=>key.startsWith(`${org}/`) && typeof quote.issuedAt==='string' && monthlyPeriod(new Date(quote.issuedAt)).key===period.key).length;
  const capacity=(used,limit)=>{if(limit!==undefined && used>=limit) throw quotaExceeded(usageMetric(used,limit));};
  return {
    catalog: {
      async list(org) {return copy(listing(org).catalogs);},
      async listing(org) {return copy(listing(org));},
      async usage(org) {return catalogUsed(org);},
      async get(org,id,version) { return copy(catalogs.get(`${org}/${id}/${version}`)); },
      async getPublished(org,id,version) {if(catalogHeads.get(`${org}/${id}`)?.active===false) return undefined;return copy(catalogs.get(`${org}/${id}/${version}`));},
      async publish(org,catalog,{limit}={}) {
        const key = `${org}/${catalog.catalogId}/${catalog.version}`;
        const existing = catalogs.get(key);
        if (existing) {
          if (hash(existing) !== hash(catalog)) throw conflict();
          return {catalog:copy(existing),created:false};
        }
        const headKey=`${org}/${catalog.catalogId}`;
        if(!catalogHeads.has(headKey)) {capacity(catalogUsed(org),limit);catalogHeads.set(headKey,{catalogId:catalog.catalogId,active:true});}
        catalogs.set(key,copy(catalog));
        return {catalog:copy(catalog),created:true};
      },
      async setStatus(org,id,active,{limit}={}) {
        const key=`${org}/${id}`;const head=catalogHeads.get(key);if(!head) throw notFound();
        if(head.active!==active) {if(active) capacity(catalogUsed(org),limit);head.active=active;}
        return copy(head);
      },
    },
    quotes: {
      async usage(org,period) {return quoteUsed(org,period);},
      async get(org,id) { return copy(quotes.get(`${org}/${id}`)); },
      async findReplay(org,key,requestHash) {
        const existing = replay.get(`${org}/${hash(key)}`);
        if (!existing) return undefined;
        if (existing.requestHash !== requestHash) throw conflict();
        return copy(quotes.get(`${org}/${existing.quoteId}`));
      },
      async issue(org,key,requestHash,quote,{limit,period=monthlyPeriod(new Date(quote.issuedAt))}={}) {
        const replayKey = `${org}/${hash(key)}`;
        const existing = replay.get(replayKey);
        if (existing) {
          if (existing.requestHash !== requestHash) throw conflict();
          return {quote:copy(quotes.get(`${org}/${existing.quoteId}`)),created:false};
        }
        capacity(quoteUsed(org,period),limit);
        quotes.set(`${org}/${quote.quoteId}`,copy(quote));
        replay.set(replayKey,{requestHash,quoteId:quote.quoteId});
        return {quote:copy(quote),created:true};
      },
    },
  };
}
