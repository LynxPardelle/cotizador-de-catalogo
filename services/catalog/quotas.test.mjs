import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogHandler } from './index.mjs';
import { createQuotingHandler } from '../quoting/index.mjs';
import { createMemoryRepositories } from '../shared/memory.mjs';
import { syntheticCatalog } from '../fixtures/catalog.mjs';

const event=(method,path,body,key)=>({version:'2.0',rawPath:`/api/v1${path}`,headers:key ? {'idempotency-key':key} : {},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{requestId:'quota-test',http:{method}}});
const decode=result=>({status:result.statusCode,body:result.body ? JSON.parse(result.body) : undefined});
function setup(){
  const repositories=createMemoryRepositories();let now=new Date('2027-01-31T23:50:00Z');
  const user={subject:'test',organizationId:'quota-org',role:'admin',plan:{id:'esencial',limits:{activeCatalogs:1,issuedQuotesPerMonth:2}}};
  const authorize=async()=>user;
  const catalog=createCatalogHandler({repository:repositories.catalog,authorize});
  const quotes=createQuotingHandler({repository:repositories.quotes,readCatalog:(org,id,version)=>repositories.catalog.getPublished(org,id,version),authorize,clock:()=>new Date(now)});
  const input={catalogId:'oficina',version:1,currency:'MXN',items:[{productId:'desk',quantity:1,optionIds:[]}]};
  return {catalog,quotes,user,input,setDate:date=>{now=new Date(date);}};
}
test('active catalog quota counts unique IDs, not revisions or publication replays',async()=>{
  const {catalog}=setup();
  assert.equal((await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog))).statusCode,201);
  assert.equal((await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog))).statusCode,200);
  assert.equal((await catalog(event('POST','/catalogs/oficina/publications',{...syntheticCatalog,version:2}))).statusCode,201);
  const denied=decode(await catalog(event('POST','/catalogs/second/publications',{...syntheticCatalog,catalogId:'second'})));
  assert.equal(denied.status,409);assert.equal(denied.body.error.code,'PLAN_LIMIT_REACHED');
  const usage=decode(await catalog(event('GET','/catalogs/usage'))).body;
  assert.deepEqual(usage,{planId:'esencial',activeCatalogs:{used:1,limit:1,remaining:0,state:'limit'}});
});
test('archiving releases capacity while preserving historical versions and issued proposals',async()=>{
  const {catalog,quotes,input,user}=setup();
  await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog));
  const saved=decode(await quotes(event('POST','/quotes',input,'before-archive'))).body;
  assert.deepEqual(decode(await catalog(event('PATCH','/catalogs/oficina/status',{active:false}))).body,{catalogId:'oficina',active:false});
  const listed=decode(await catalog(event('GET','/catalogs'))).body;
  assert.equal(listed.catalogs.length,0);assert.equal(listed.archivedCatalogs.length,1);
  assert.equal((await catalog(event('GET','/catalogs/oficina/versions/1'))).statusCode,200);
  assert.equal((await quotes(event('POST','/quotes/preview',input))).statusCode,404);
  assert.deepEqual(decode(await quotes(event('POST','/quotes',input,'before-archive'))).body,saved);
  assert.deepEqual(decode(await quotes(event('GET',`/quotes/${saved.quoteId}`))).body,saved);
  user.role='reader';const reader=decode(await catalog(event('GET','/catalogs'))).body;
  assert.ok(!Object.hasOwn(reader,'archivedCatalogs'));
  assert.equal((await catalog(event('GET','/catalogs/usage'))).statusCode,200);
  assert.equal((await quotes(event('GET','/quotes/usage'))).statusCode,200);
});
test('reactivation and first publication share capacity and concurrent activations cannot exceed it',async()=>{
  const {catalog}=setup();
  await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog));
  await catalog(event('PATCH','/catalogs/oficina/status',{active:false}));
  await catalog(event('POST','/catalogs/second/publications',{...syntheticCatalog,catalogId:'second'}));
  assert.equal((await catalog(event('PATCH','/catalogs/oficina/status',{active:true}))).statusCode,409);
  await catalog(event('PATCH','/catalogs/second/status',{active:false}));
  const results=await Promise.all(['oficina','second'].map(id=>catalog(event('PATCH',`/catalogs/${id}/status`,{active:true}))));
  assert.deepEqual(results.map(result=>result.statusCode).sort(),[200,409]);
  assert.equal(decode(await catalog(event('GET','/catalogs/usage'))).body.activeCatalogs.used,1);
});
test('monthly issuance quota is atomic, idempotent and does not limit previews or reads',async()=>{
  const {catalog,quotes,input}=setup();await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog));
  const results=await Promise.all(Array.from({length:8},(_,i)=>quotes(event('POST','/quotes',input,`independent-${i}`))));
  assert.equal(results.filter(result=>result.statusCode===201).length,2);
  assert.equal(results.filter(result=>result.statusCode===409).length,6);
  assert.equal((await quotes(event('POST','/quotes/preview',input))).statusCode,200);
  const saved=JSON.parse(results.find(result=>result.statusCode===201).body);
  assert.equal((await quotes(event('GET',`/quotes/${saved.quoteId}`))).statusCode,200);
  const usage=decode(await quotes(event('GET','/quotes/usage'))).body;
  assert.equal(usage.issuedQuotesPerMonth.used,2);assert.equal(usage.issuedQuotesPerMonth.state,'limit');assert.equal(usage.period.key,'2027-01');
});
test('a month rollover starts fresh usage and replay never consumes the new month',async()=>{
  const {catalog,quotes,input,setDate}=setup();await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog));
  const saved=decode(await quotes(event('POST','/quotes',input,'old-month'))).body;
  setDate('2027-02-01T00:00:00Z');
  assert.equal(decode(await quotes(event('GET','/quotes/usage'))).body.issuedQuotesPerMonth.used,0);
  assert.deepEqual(decode(await quotes(event('POST','/quotes',input,'old-month'))).body,saved);
  assert.equal(decode(await quotes(event('GET','/quotes/usage'))).body.issuedQuotesPerMonth.used,0);
  assert.equal((await quotes(event('POST','/quotes',input,'new-month'))).statusCode,201);
});
test('downgrades report over-limit without removing data and upgrades permit the next operation',async()=>{
  const {catalog,quotes,input,user}=setup();await catalog(event('POST','/catalogs/oficina/publications',syntheticCatalog));
  await quotes(event('POST','/quotes',input,'one'));await quotes(event('POST','/quotes',input,'two'));
  user.plan.limits.issuedQuotesPerMonth=1;
  assert.equal(decode(await quotes(event('GET','/quotes/usage'))).body.issuedQuotesPerMonth.state,'over');
  assert.equal((await quotes(event('POST','/quotes',input,'three'))).statusCode,409);
  user.plan.limits.issuedQuotesPerMonth=3;
  assert.equal((await quotes(event('POST','/quotes',input,'three'))).statusCode,201);
});
