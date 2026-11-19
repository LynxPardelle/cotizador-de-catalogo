import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuotingHandler } from './index.mjs';
import { createMemoryRepositories } from '../shared/memory.mjs';
import { syntheticCatalog } from '../fixtures/catalog.mjs';

const flowA='11111111-1111-4111-8111-111111111111';
const flowB='22222222-2222-4222-8222-222222222222';
const correctionA='33333333-3333-4333-8333-333333333333';
const correctionB='44444444-4444-4444-8444-444444444444';
const pilot=(duration=60000,adjustments=0)=>({flowId:flowA,activeDurationMs:duration,adjustments});
const event=(method,path,body,key,query='')=>({version:'2.0',rawPath:`/api/v1${path}`,rawQueryString:query,headers:key ? {'idempotency-key':key} : {},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{requestId:'pilot-test',http:{method}}});
const decode=r=>({status:r.statusCode,body:JSON.parse(r.body)});
async function setup(){
  const repositories=createMemoryRepositories();await repositories.catalog.publish('pilot-org',syntheticCatalog);
  let now=new Date('2027-01-20T12:00:00Z');
  const user={subject:'private-subject',organizationId:'pilot-org',role:'admin',plan:{id:'esencial',limits:{activeCatalogs:2,issuedQuotesPerMonth:100}}};
  const handler=createQuotingHandler({repository:repositories.quotes,readCatalog:(org,id,version)=>repositories.catalog.getPublished(org,id,version),authorize:async()=>user,clock:()=>new Date(now)});
  const request={catalogId:'oficina',version:1,currency:'MXN',items:[{productId:'desk',quantity:1,optionIds:[]}]};
  return {handler,repositories,user,request,setDate:date=>{now=new Date(date);}};
}
test('pilot is optional but supplied telemetry must be complete, bounded and contain no unknown fields',async()=>{
  const {handler,request}=await setup();
  for(const value of [null,{}, {...pilot(),flowId:'bad'}, {...pilot(),activeDurationMs:-1}, {...pilot(),activeDurationMs:28800001}, {...pilot(),activeDurationMs:0.5}, {...pilot(),adjustments:1001}, {...pilot(),adjustments:-1}, {...pilot(),extra:'private text'}]) {
    assert.equal((await handler(event('POST','/quotes/preview',{...request,pilot:value}))).statusCode,400);
    assert.equal((await handler(event('POST','/quotes',{...request,pilot:value},'invalid'))).statusCode,400);
  }
  assert.equal(decode(await handler(event('GET','/quotes/usage'))).body.issuedQuotesPerMonth.used,0);
});
test('preview accepts valid pilot data without changing the commercial response',async()=>{
  const {handler,request}=await setup();
  const plain=decode(await handler(event('POST','/quotes/preview',request))).body;
  const measured=decode(await handler(event('POST','/quotes/preview',{...request,pilot:pilot(0,0)})));
  assert.equal(measured.status,200);assert.deepEqual(measured.body,plain);assert.ok(!Object.hasOwn(measured.body,'pilot'));
});
test('issuance freezes the first pilot snapshot while commercial idempotency ignores later valid telemetry',async()=>{
  const {handler,request}=await setup();
  const first=decode(await handler(event('POST','/quotes',{...request,pilot:pilot()},'same-business')));
  assert.equal(first.status,201);assert.deepEqual(first.body.pilot,pilot());
  const replay=decode(await handler(event('POST','/quotes',{...request,pilot:{...pilot(120000,2),flowId:flowB}},'same-business')));
  assert.equal(replay.status,200);assert.deepEqual(replay.body,first.body);
  assert.equal((await handler(event('POST','/quotes',{...request,pilot:{bad:true}},'same-business'))).statusCode,400);
  assert.equal(decode(await handler(event('GET','/quotes/usage'))).body.issuedQuotesPerMonth.used,1);
});
test('metrics count every legacy emission while separating missing timing and issuer coverage',async()=>{
  const {handler,repositories,request}=await setup();
  const one=decode(await handler(event('POST','/quotes',{...request,pilot:pilot(60000,0)},'one'))).body;
  await handler(event('POST','/quotes',{...request,pilot:pilot(120000,2)},'two'));
  await handler(event('POST','/quotes',request,'three'));
  const legacy={...structuredClone(one),quoteId:'legacy-quote',issuedAt:'2027-01-19T12:00:00.000Z'};delete legacy.pilot;
  await repositories.quotes.issue('pilot-org','legacy-key','legacy-hash',legacy);
  await repositories.quotes.issue('pilot-org','older-key','older-hash',{...legacy,quoteId:'older-quote',issuedAt:'2027-01-01T12:00:00.000Z'});
  const result=decode(await handler(event('GET','/quotes/metrics',undefined,undefined,'days=7')));
  assert.equal(result.status,200);const metric=result.body;
  assert.equal(metric.totalIssued,4);assert.equal(metric.activeIssuers,1);assert.equal(metric.missingIssuerCount,1);
  assert.deepEqual(metric.time,{sampleSize:2,missingCount:2,meanMs:90000,medianMs:90000});
  assert.deepEqual(metric.adjustments,{total:2,quotesWithAdjustments:1});
  assert.equal(metric.daily.length,7);assert.equal(metric.daily.find(day=>day.date==='2027-01-20').issued,3);
  assert.equal(metric.daily.find(day=>day.date==='2027-01-19').issued,1);
  assert.equal(metric.daily.find(day=>day.date==='2027-01-14').issued,0);
  assert.ok(!JSON.stringify(metric).includes('private-subject'));assert.ok(!JSON.stringify(metric).includes(flowA));assert.ok(!JSON.stringify(metric).includes('450000'));
});
test('correction reports are deduplicated declarations and never edit snapshots or consume quota',async()=>{
  const {handler,request,user}=await setup();
  const saved=decode(await handler(event('POST','/quotes',request,'quote'))).body;
  const path=`/quotes/${saved.quoteId}/corrections`;const body={correctionId:correctionA,reason:'quantity'};
  user.role='reader';assert.equal((await handler(event('POST',path,body))).statusCode,403);
  assert.equal((await handler(event('GET','/quotes/metrics'))).statusCode,403);
  user.role='seller';assert.equal((await handler(event('GET','/quotes/metrics'))).statusCode,403);
  const first=decode(await handler(event('POST',path,body)));assert.equal(first.status,201);
  assert.deepEqual(first.body,{quoteId:saved.quoteId,correctionId:correctionA,reason:'quantity',reportedAt:'2027-01-20T12:00:00.000Z'});
  const replay=decode(await handler(event('POST',path,body)));assert.equal(replay.status,200);assert.deepEqual(replay.body,first.body);
  assert.equal((await handler(event('POST',path,{...body,reason:'other'}))).statusCode,409);
  assert.equal((await handler(event('POST',path,{correctionId:correctionB,reason:'pricing'}))).statusCode,201);
  assert.deepEqual(decode(await handler(event('GET',`/quotes/${saved.quoteId}`))).body,saved);
  assert.equal(decode(await handler(event('GET','/quotes/usage'))).body.issuedQuotesPerMonth.used,1);
  user.role='admin';const metric=decode(await handler(event('GET','/quotes/metrics'))).body;
  assert.deepEqual(metric.corrections,{total:2,affectedQuotes:1,byReason:{quantity:1,options:0,catalog:0,pricing:1,other:0}});
  assert.equal(metric.daily.find(day=>day.date==='2027-01-20').corrections,2);
});
test('correction validation and organization isolation precede event creation',async()=>{
  const {handler,request,user}=await setup();
  const quote=decode(await handler(event('POST','/quotes',request,'saved'))).body;
  for(const body of [{correctionId:'invalid',reason:'quantity'},{correctionId:correctionA,reason:'unknown'},{correctionId:correctionA,reason:'other',details:'private free text'}]) assert.equal((await handler(event('POST',`/quotes/${quote.quoteId}/corrections`,body))).statusCode,400);
  user.organizationId='another-org';assert.equal((await handler(event('POST',`/quotes/${quote.quoteId}/corrections`,{correctionId:correctionA,reason:'other'}))).statusCode,404);
});
test('correction date belongs to its own reporting window even when the proposal was issued earlier',async()=>{
  const {handler,request,setDate}=await setup();setDate('2027-01-01T12:00:00Z');
  const saved=decode(await handler(event('POST','/quotes',request,'old'))).body;
  setDate('2027-01-20T12:00:00Z');await handler(event('POST',`/quotes/${saved.quoteId}/corrections`,{correctionId:correctionA,reason:'options'}));
  const metric=decode(await handler(event('GET','/quotes/metrics',undefined,undefined,'days=7'))).body;
  assert.equal(metric.totalIssued,0);assert.equal(metric.corrections.total,1);assert.equal(metric.corrections.affectedQuotes,1);
  assert.deepEqual(metric.time,{sampleSize:0,missingCount:0,meanMs:null,medianMs:null});
});
test('metrics restrict the calendar window to seven, thirty or ninety days and include today in UTC',async()=>{
  const {handler}=await setup();
  for(const days of ['0','14','07','all','7&days=90']) assert.equal((await handler(event('GET','/quotes/metrics',undefined,undefined,`days=${days}`))).statusCode,400);
  const metric=decode(await handler(event('GET','/quotes/metrics'))).body;
  assert.deepEqual(metric.window,{days:30,startsAt:'2026-12-22T00:00:00.000Z',endsAt:'2027-01-21T00:00:00.000Z',asOf:'2027-01-20T12:00:00.000Z'});
  assert.equal(metric.daily.length,30);
});
