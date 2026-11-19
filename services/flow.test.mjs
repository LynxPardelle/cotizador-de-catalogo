import assert from 'node:assert/strict';
import test from 'node:test';
const modules = await Promise.all(['./catalog/index.mjs', './quoting/index.mjs', './shared/memory.mjs'].map(path => import(path).catch(() => ({}))));
const [catalogModule, quoteModule, memoryModule] = modules;
const sample = {catalogId:'office',name:'Oficina',version:1,currency:'MXN',currencyExponent:2,rounding:'half-up',validUntil:'2099-12-31T23:59:59Z',products:[{id:'desk',name:'Escritorio',basePriceMinor:'450000',options:[{id:'oak',name:'Roble',priceMinor:'80000'}],incompatibleOptions:[]}],rules:[]};
const request = {catalogId:'office',version:1,currency:'MXN',items:[{productId:'desk',quantity:2,optionIds:['oak']}]};
function event(method, path, body, {org='a',role='admin',key}={}) {
  return {version:'2.0',rawPath:`/api/v1${path}`,headers:{...(key ? {'idempotency-key':key} : {})},body:body === undefined ? undefined : JSON.stringify(body),requestContext:{requestId:'request-test',http:{method},authorizer:{jwt:{claims:{sub:'person',token_use:'access','cognito:groups':[`org:${org}:${role}`]}}}}};
}
const decode = response => ({status:response.statusCode,body:JSON.parse(response.body)});
async function setup() {
  assert.equal(typeof memoryModule.createMemoryRepositories,'function');
  const repositories = memoryModule.createMemoryRepositories();
  const catalog = catalogModule.createCatalogHandler({repository:repositories.catalog});
  const quotes = quoteModule.createQuotingHandler({repository:repositories.quotes,readCatalog:(org,id,version)=>repositories.catalog.get(org,id,version)});
  return {catalog,quotes};
}
test('publication → preview → issue → later revision keeps original snapshot',async()=>{
  const {catalog,quotes}=await setup();
  assert.equal(decode(await catalog(event('POST','/catalogs/office/publications',sample))).status,201);
  const preview=decode(await quotes(event('POST','/quotes/preview',request)));
  assert.equal(preview.status,200);
  assert.equal(preview.body.totalMinor,'1060000');
  const emitted=decode(await quotes(event('POST','/quotes',request,{key:'same-request'})));
  assert.equal(emitted.status,201);
  assert.ok(emitted.body.quoteId);
  assert.deepEqual(emitted.body.lines[0].selectedOptions,[{id:'oak',name:'Roble',priceMinor:'80000'}]);
  const next={...sample,version:2,products:[{...sample.products[0],basePriceMinor:'900000',options:[{id:'oak',name:'Roble premium',priceMinor:'120000'}]}]};
  assert.equal(decode(await catalog(event('POST','/catalogs/office/publications',next))).status,201);
  const saved=decode(await quotes(event('GET',`/quotes/${emitted.body.quoteId}`)));
  assert.deepEqual(saved.body,emitted.body);
  assert.equal(saved.body.version,1);
  assert.equal(saved.body.totalMinor,'1060000');
  assert.deepEqual(saved.body.lines[0].selectedOptions,[{id:'oak',name:'Roble',priceMinor:'80000'}]);
  assert.equal(decode(await catalog(event('GET','/catalogs'))).body.catalogs[0].version,2);
});
test('idempotent issuance survives parallel retries and rejects changed content',async()=>{
  const {catalog,quotes}=await setup();
  await catalog(event('POST','/catalogs/office/publications',sample));
  const retries=await Promise.all(Array.from({length:8},()=>quotes(event('POST','/quotes',request,{key:'retry-key'}))));
  const ids=retries.map(r=>decode(r).body.quoteId);
  assert.equal(new Set(ids).size,1);
  assert.ok(ids[0]);
  const changed={...request,items:[{...request.items[0],quantity:3}]};
  assert.equal(decode(await quotes(event('POST','/quotes',changed,{key:'retry-key'}))).status,409);
  assert.equal(decode(await quotes(event('POST','/quotes',request))).status,400);
});
test('organization isolation, immutable catalog versions and role authorization',async()=>{
  const {catalog,quotes}=await setup();
  await catalog(event('POST','/catalogs/office/publications',sample));
  assert.equal(decode(await catalog(event('POST','/catalogs/office/publications',{...sample,name:'Changed'}))).status,409);
  assert.equal(decode(await catalog(event('GET','/catalogs/office/versions/1',undefined,{org:'b'}))).status,404);
  assert.equal(decode(await quotes(event('POST','/quotes/preview',request,{org:'b'}))).status,404);
  const saved=decode(await quotes(event('POST','/quotes',request,{key:'one'}))).body;
  assert.equal(decode(await quotes(event('GET',`/quotes/${saved.quoteId}`,undefined,{org:'b'}))).status,404);
  assert.equal(decode(await quotes(event('POST','/quotes/preview',request,{role:'reader'}))).status,403);
  assert.equal(decode(await catalog(event('POST','/catalogs/office/publications',{...sample,version:2},{role:'seller'}))).status,403);
});
test('rejects untrusted organization fields, invalid JSON and HTTP impersonation of internal calls',async()=>{
  const {catalog,quotes}=await setup();
  assert.equal(decode(await catalog(event('POST','/catalogs/office/publications',{...sample,organizationId:'b'}))).status,400);
  const bad=event('POST','/quotes/preview',request); bad.body='{';
  assert.equal(decode(await quotes(bad)).status,400);
  const anonymous=event('GET','/catalogs'); delete anonymous.requestContext.authorizer;
  anonymous.operation='getPublishedCatalog'; anonymous.organizationId='a';
  assert.equal(decode(await catalog(anonymous)).status,401);
});
