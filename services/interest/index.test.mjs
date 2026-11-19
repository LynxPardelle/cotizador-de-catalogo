import test from 'node:test';
import assert from 'node:assert/strict';
const {createInterestHandler}=await import('./index.mjs').catch(()=>({}));
const {createMemoryInterestRepository}=await import('./memory.mjs').catch(()=>({}));
const requestId='11111111-1111-4111-8111-111111111111';
const sample=(id=requestId)=>({requestId:id,organizationName:'Oficina piloto',contactEmail:'equipo@example.invalid',sector:'Mobiliario',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'not-sure',contactConsent:true,privacyVersion:'2026-11-19'});
const event=(body=sample(),method='POST',path='/api/v1/pilot-interest')=>({version:'2.0',rawPath:path,headers:{},body:JSON.stringify(body),requestContext:{requestId:'interest-test',http:{method}}});
const decode=result=>({status:result.statusCode,headers:result.headers,body:JSON.parse(result.body)});
function setup({limit=200,date='2026-11-19T23:00:00Z'}={}){assert.equal(typeof createInterestHandler,'function');assert.equal(typeof createMemoryInterestRepository,'function');let now=new Date(date);const repository=createMemoryInterestRepository();return {repository,handler:createInterestHandler({repository,clock:()=>new Date(now),dailyLimit:limit}),setDate:value=>{now=new Date(value);}};}

test('public interest registration exists independently from authenticated business services',()=>{
  assert.equal(typeof createInterestHandler,'function');assert.equal(typeof createMemoryInterestRepository,'function');
});
test('anonymous registration stores normalized consent and expiry but returns only a receipt',async()=>{
  const {handler,repository}=setup();const body={...sample(),organizationName:'  Oficina piloto  ',contactEmail:'  EQUIPO@EXAMPLE.INVALID  ',sector:' Mobiliario '};
  const result=decode(await handler(event(body)));assert.equal(result.status,202);assert.deepEqual(result.body,{reference:requestId,status:'received'});assert.equal(result.headers['cache-control'],'no-store');
  const stored=await repository.get(requestId);assert.equal(stored.record.contactEmail,'equipo@example.invalid');assert.equal(stored.record.organizationName,'Oficina piloto');assert.equal(stored.record.sector,'Mobiliario');
  assert.equal(stored.record.createdAt,'2026-11-19T23:00:00.000Z');assert.equal(stored.record.acceptedAt,stored.record.createdAt);assert.equal(stored.record.contactConsent,true);assert.equal(stored.record.privacyVersion,'2026-11-19');
  assert.equal(stored.record.expiresAt,Math.floor(Date.parse(stored.record.createdAt)/1000)+90*86400);assert.equal(stored.record.status,'received');
  for(const forbidden of ['equipo@example.invalid','Oficina piloto','Mobiliario','createdAt','expiresAt','organizationId'])assert.ok(!JSON.stringify(result.body).includes(forbidden));
  assert.ok(!Object.hasOwn(stored.record,'ip')&&!Object.hasOwn(stored.record,'userAgent'));
});
test('required consent, bounded contact fields, fixed choices and exact schema fail without storing data',async()=>{
  const {handler,repository}=setup();
  for(const invalid of [
    {contactConsent:false},{contactConsent:'true'},{privacyVersion:'old'},{organizationName:'x'},{organizationName:'x'.repeat(101)},{sector:'x'},{sector:'a'.repeat(81)},
    {organizationName:'Office\nprivate'},{sector:'Services\u202e'},{contactEmail:'bad-email'},{contactEmail:'a'.repeat(245)+'@example.invalid'},{requestId:'not-a-uuid'},
    {currentMethod:'unknown'},{monthlyQuotes:'100000'},{twoParticipants:'maybe'},{timeAvailability:'maybe'},{details:'private free notes'},{organizationId:'another-org'},{attachments:[]},
  ]){const result=decode(await handler(event({...sample(),...invalid})));assert.equal(result.status,400);assert.equal(result.body.error.code,'INVALID_REQUEST');}
  const missing=sample();delete missing.contactEmail;assert.equal((await handler(event(missing))).statusCode,400);assert.equal(await repository.get(requestId),undefined);
});
test('oversized, encoded, nonobject and malformed requests are rejected before persistence',async()=>{
  const {handler,repository}=setup();
  assert.equal((await handler({...event(),body:'x'.repeat(8193)})).statusCode,413);
  assert.equal((await handler({...event(),isBase64Encoded:true})).statusCode,400);
  for(const raw of ['{','null','[]','true'])assert.equal((await handler({...event(),body:raw})).statusCode,400);
  assert.equal(await repository.get(requestId),undefined);
});
test('retries preserve original consent and quota while changed content conflicts',async()=>{
  const {handler,repository,setDate}=setup({limit:1});const first=decode(await handler(event()));setDate('2026-11-20T01:00:00Z');
  assert.deepEqual(decode(await handler(event({...sample(),organizationName:' Oficina piloto ',contactEmail:'EQUIPO@EXAMPLE.INVALID'}))).body,first.body);
  assert.equal((await repository.get(requestId)).record.acceptedAt,'2026-11-19T23:00:00.000Z');
  const conflict=decode(await handler(event({...sample(),sector:'Otra industria'})));assert.equal(conflict.status,409);assert.equal(conflict.body.error.code,'CONFLICT');
});
test('parallel identical submissions create one record and retain capacity for another unique request',async()=>{
  const {handler}=setup({limit:2});const results=await Promise.all(Array.from({length:8},()=>handler(event())));
  assert.ok(results.every(result=>result.statusCode===202));assert.equal(new Set(results.map(result=>result.body)).size,1);
  assert.equal((await handler(event(sample('22222222-2222-4222-8222-222222222222')))).statusCode,202);
  assert.equal((await handler(event(sample('33333333-3333-4333-8333-333333333333')))).statusCode,429);
});
test('daily limit returns next UTC retry interval, never blocks a committed replay and resets by day',async()=>{
  const {handler,setDate}=setup({limit:1});assert.equal((await handler(event())).statusCode,202);
  const next=sample('22222222-2222-4222-8222-222222222222');const limited=decode(await handler(event(next)));
  assert.equal(limited.status,429);assert.equal(limited.body.error.code,'INTEREST_LIMIT_REACHED');assert.equal(limited.headers['retry-after'],'3600');
  assert.equal((await handler(event())).statusCode,202);setDate('2026-11-20T00:00:00Z');assert.equal((await handler(event(next))).statusCode,202);
});
test('interest does not expose reads or mutate accounts and sanitized errors never reflect applicant fields',async()=>{
  const {handler}=setup();for(const [method,path]of[['GET','/api/v1/pilot-interest'],['POST','/api/v1/pilot-interest/other'],['DELETE','/api/v1/pilot-interest']])assert.equal((await handler(event(sample(),method,path))).statusCode,404);
  const messages=[];const old=console.error;console.error=value=>messages.push(value);
  try{const broken=createInterestHandler({repository:{submit:async()=>{throw new Error('secret equipo@example.invalid Oficina piloto');}}});const response=decode(await broken(event()));assert.equal(response.status,500);const output=JSON.stringify([response,messages]);assert.ok(!output.includes('equipo@example.invalid'));assert.ok(!output.includes('Oficina piloto'));assert.ok(!output.includes('secret'));}
  finally{console.error=old;}
});
