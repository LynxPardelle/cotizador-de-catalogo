import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCatalogHandler } from '../services/catalog/index.mjs';
import { createQuotingHandler } from '../services/quoting/index.mjs';
import { createMemoryRepositories } from '../services/shared/memory.mjs';
import { syntheticCatalog } from '../services/fixtures/catalog.mjs';

const repositories = createMemoryRepositories();
const catalog = createCatalogHandler({ repository: repositories.catalog });
const quotes = createQuotingHandler({
  repository: repositories.quotes,
  readCatalog: (org, id, version) => repositories.catalog.get(org, id, version),
});
const event = (method, path, body, key, org = 'pilot') => ({
  version: '2.0', rawPath: `/api/v1${path}`,
  headers: key ? { 'idempotency-key': key } : {},
  body: body === undefined ? undefined : JSON.stringify(body),
  requestContext: {
    requestId: 'synthetic-pilot', http: { method },
    authorizer: { jwt: { claims: { sub: 'synthetic-user', token_use: 'access', 'cognito:groups': [`org:${org}:admin`] } } },
  },
});
const decode = (response, expected) => {
  assert.equal(response.statusCode, expected, response.body);
  return JSON.parse(response.body);
};
decode(await catalog(event('POST', `/catalogs/${syntheticCatalog.catalogId}/publications`, syntheticCatalog)), 201);
const requestBody = {
  catalogId: syntheticCatalog.catalogId, version: syntheticCatalog.version, currency: syntheticCatalog.currency,
  items: [{ productId: 'desk', quantity: 5, optionIds: ['oak', 'assembly'] }],
};
const timings = [];
for (let i = 0; i < 250; i++) {
  const start = performance.now();
  decode(await quotes(event('POST', '/quotes/preview', requestBody)), 200);
  timings.push(performance.now() - start);
}
const issued = decode(await quotes(event('POST', '/quotes', requestBody, 'pilot-retry')), 201);
const v2 = structuredClone(syntheticCatalog);
v2.version += 1;
v2.products[0].basePriceMinor = '900000';
decode(await catalog(event('POST', `/catalogs/${v2.catalogId}/publications`, v2)), 201);
const saved = decode(await quotes(event('GET', `/quotes/${issued.quoteId}`)), 200);
assert.deepEqual(saved, issued);
const replay = await quotes(event('POST', '/quotes', requestBody, 'pilot-retry'));
assert.ok([200, 201].includes(replay.statusCode), replay.body);
assert.deepEqual(JSON.parse(replay.body), issued);
assert.equal((await quotes(event('GET', `/quotes/${issued.quoteId}`, undefined, undefined, 'other'))).statusCode, 404);
timings.sort((a, b) => a - b);
const report = {
  product: 'CotiTrama', generatedAt: new Date().toISOString(),
  environment: 'local-memory-synthetic', samples: timings.length,
  latencyMs: { p50: timings[124], p95: timings[237], max: timings.at(-1) },
  checks: { immutableSnapshotAfterV2: true, idempotentReplay: true, crossOrganization404: true },
  commercialMetrics: { minutesPerQuote: null, priceCorrections: null, reusableRulesAcrossRealCatalogs: null },
  limitation: 'Carga sintética local; no mide AWS ni demanda/productividad comercial.',
};
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/pilot-local.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
