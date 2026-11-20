import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('./index.mjs').catch(()=>({}));
const memory=await import('./memory.mjs').catch(()=>({}));
const reference='11111111-1111-4111-8111-111111111111',mutationId='22222222-2222-4222-8222-222222222222';
const createdAt='2026-11-19T12:00:00.000Z';
const record={requestId:reference,organizationName:'Oficina autorizada',contactEmail:'equipo@example.invalid',sector:'Mobiliario',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'not-sure',contactConsent:true,privacyVersion:'2026-11-19',status:'received',createdAt,acceptedAt:createdAt,expiresAt:1802952000};
const item=()=>({PK:`INTEREST#${reference}`,SK:'RECORD',reference,status:'received',createdAt,expiresAt:record.expiresAt,requestHash:'original-hash',record:structuredClone(record)});
const event=(method='GET',suffix='',body,query='')=>({version:'2.0',rawPath:`/api/v1/pilot-applications${suffix}`,rawQueryString:query,headers:{'x-organization-id':'forged-org'},body:body===undefined?undefined:JSON.stringify(body),requestContext:{requestId:'applications-test',http:{method}}});
const decode=r=>({status:r.statusCode,body:JSON.parse(r.body)});
function setup(){assert.equal(typeof module.createApplicationsHandler,'function');assert.equal(typeof memory.createMemoryApplicationsRepository,'function');const itemsMap=new Map([[`INTEREST#${reference}/RECORD`,item()]]);const repository=memory.createMemoryApplicationsRepository({itemsMap});let now=new Date('2026-11-20T12:00:00Z');const handler=module.createApplicationsHandler({repository,authorize:async()=>({subject:'private-reviewer'}),clock:()=>new Date(now)});return {handler,repository,itemsMap,setDate:x=>{now=new Date(x);}};}
const update=(overrides={})=>({mutationId,expectedVersion:0,status:'reviewing',nextActionDate:'2026-11-25',note:'Revisar disponibilidad.',...overrides});

test('private applications management requires an explicit authorizer and returns context only after authorization',async()=>{
 assert.equal(typeof module.createApplicationsHandler,'function');assert.throws(()=>module.createApplicationsHandler({repository:{}}));const {handler}=setup();assert.deepEqual(decode(await handler(event('GET','/context'))),{status:200,body:{allowed:true}});
 const denied=module.createApplicationsHandler({repository:{list:()=>assert.fail('must not read applications')},authorize:async()=>{throw Object.assign(new Error('Denied'),{statusCode:403,code:'FORBIDDEN'});}});assert.equal((await denied(event())).statusCode,403);
});
test('legacy records remain visible, list excludes contact details and detail retains the original application',async()=>{
 const {handler}=setup();const listing=decode(await handler(event()));assert.equal(listing.status,200);assert.equal(listing.body.items.length,1);assert.deepEqual(listing.body.items[0].review,{status:'received',version:0,updatedAt:createdAt,nextActionDate:''});assert.ok(!JSON.stringify(listing.body).includes(record.contactEmail));assert.ok(!JSON.stringify(listing.body).includes('original-hash'));
 const detail=decode(await handler(event('GET',`/${reference}`)));assert.equal(detail.status,200);assert.deepEqual(detail.body.application,record);assert.ok(!JSON.stringify(detail.body).includes('original-hash'));
});
test('updates keep intake immutable and create one audited event, with frozen replay and optimistic conflict',async()=>{
 const {handler,itemsMap}=setup();const original=structuredClone(itemsMap.get(`INTEREST#${reference}/RECORD`));const first=decode(await handler(event('PATCH',`/${reference}`,update())));assert.equal(first.status,200);assert.equal(first.body.review.version,1);assert.equal(first.body.review.status,'reviewing');
 const stored=itemsMap.get(`INTEREST#${reference}/RECORD`);assert.deepEqual(stored.record,original.record);assert.equal(stored.status,'received');assert.equal(stored.requestHash,original.requestHash);assert.equal(stored.expiresAt,original.expiresAt);
 assert.deepEqual(decode(await handler(event('PATCH',`/${reference}`,update()))).body,first.body);assert.equal((await handler(event('PATCH',`/${reference}`,update({note:'changed'})))).statusCode,409);
 const stale=decode(await handler(event('PATCH',`/${reference}`,update({mutationId:'33333333-3333-4333-8333-333333333333'}))));assert.equal(stale.status,409);assert.equal(stale.body.error.code,'REVIEW_CONFLICT');
 const history=decode(await handler(event('GET',`/${reference}/history`)));assert.equal(history.body.items.length,1);assert.equal(history.body.items[0].previousStatus,'received');assert.equal(history.body.items[0].note,'Revisar disponibilidad.');assert.match(history.body.items[0].actorKey,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(history.body).includes('private-reviewer'));
});
test('parallel expected-version updates commit only one change and notes do not extend retention',async()=>{
 const {handler,itemsMap}=setup();const results=await Promise.all([handler(event('PATCH',`/${reference}`,update())),handler(event('PATCH',`/${reference}`,update({mutationId:'33333333-3333-4333-8333-333333333333',status:'needs_info'})))]);assert.deepEqual(results.map(x=>x.statusCode).sort(),[200,409]);assert.equal((await handler(event('GET',`/${reference}/history`))).statusCode,200);
 for(const value of itemsMap.values())if(value.SK.startsWith('REVIEW#')||value.SK.startsWith('REPLAY#'))assert.equal(value.expiresAt,record.expiresAt);
});
test('strict review validation rejects forged identity, invalid dates, overlong notes and unknown state',async()=>{
 const {handler}=setup();for(const changed of [{mutationId:'bad'},{expectedVersion:-1},{expectedVersion:0.5},{status:'admin'},{nextActionDate:'2026-02-31'},{nextActionDate:'2026-11-25T00:00:00Z'},{note:'x'.repeat(501)},{note:'secret\u0000value'},{note:'one\rtwo'},{note:'one\u0085two'},{actorKey:'forged'},{organizationId:'forged'},{contactEmail:'replacement@example.invalid'}])assert.equal((await handler(event('PATCH',`/${reference}`,update(changed)))).statusCode,400);
 assert.equal((await handler(event('PATCH',`/${reference}`,update({nextActionDate:'',note:''})))).statusCode,200);
});
test('expired records are unavailable to detail, history, updates and replay before asynchronous TTL deletion',async()=>{
 const {handler,setDate}=setup();await handler(event('PATCH',`/${reference}`,update()));setDate(new Date(record.expiresAt*1000).toISOString());assert.equal(decode(await handler(event())).body.items.length,0);
 for(const [method,path,body]of[['GET',`/${reference}`],['GET',`/${reference}/history`],['PATCH',`/${reference}`,update()]])assert.equal((await handler(event(method,path,body))).statusCode,404);
});
test('status filtering includes legacy received and cursors cannot change kind, filter or reference',async()=>{
 const {handler}=setup();assert.equal(decode(await handler(event('GET','',undefined,'status=received'))).body.items.length,1);assert.equal(decode(await handler(event('GET','',undefined,'status=selected'))).body.items.length,0);
 for(const query of ['status=unknown','status=all&status=received','email=private@example.invalid','cursor=bad'])assert.equal((await handler(event('GET','',undefined,query))).statusCode,400);
 assert.equal((await handler(event('GET',`/${reference}/history`,undefined,'cursor=bad'))).statusCode,400);
 assert.equal((await handler(event('GET','/not-a-uuid'))).statusCode,400);
});

test('valid continuations cannot be reused for another filter, application, operation or table',async()=>{
 const {handler}=setup(),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const list={v:1,kind:'list',status:'all',key:{PK:`INTEREST#${reference}`,SK:'RECORD'}};
 const history={v:1,kind:'history',reference,key:{PK:`INTEREST#${reference}`,SK:'REVIEW#000000000001'}};
 assert.equal((await handler(event('GET','',undefined,`cursor=${encode(list)}`))).statusCode,200);
 for(const cursor of [encode({...list,status:'received'}),encode(history),encode({...list,table:'another-table'}),encode({...list,key:{...list.key,TableName:'another-table'}}),encode({...list,v:2}),`${encode(list)}=`]){
  assert.equal((await handler(event('GET','',undefined,`cursor=${encodeURIComponent(cursor)}`))).statusCode,400);
 }
 assert.equal((await handler(event('GET',`/${reference}/history`,undefined,`cursor=${encode(list)}`))).statusCode,400);
 assert.equal((await handler(event('GET','/33333333-3333-4333-8333-333333333333/history',undefined,`cursor=${encode(history)}`))).statusCode,400);
});

test('list and history continuations return the rest without repeating prior applications or events',async()=>{
 const {handler,itemsMap}=setup();
 for(let index=2;index<=26;index++){
  const reference=`${String(index).padStart(8,'0')}-1111-4111-8111-111111111111`,value=item();
  Object.assign(value,{PK:`INTEREST#${reference}`,reference});value.record.requestId=reference;
  itemsMap.set(`${value.PK}/RECORD`,value);
 }
 const first=decode(await handler(event())).body;assert.equal(first.items.length,25);assert.ok(first.nextCursor);
 const second=decode(await handler(event('GET','',undefined,`cursor=${first.nextCursor}`))).body;assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(row=>row.reference)).size,26);
 for(let index=0;index<22;index++)assert.equal((await handler(event('PATCH',`/${reference}`,update({mutationId:`${String(index+100).padStart(8,'0')}-1111-4111-8111-111111111111`,expectedVersion:index,note:`Seguimiento ${index+1}`})))).statusCode,200);
 const history=decode(await handler(event('GET',`/${reference}/history`))).body;assert.equal(history.items.length,20);assert.equal(history.items[0].version,22);assert.ok(history.nextCursor);
 const rest=decode(await handler(event('GET',`/${reference}/history`,undefined,`cursor=${history.nextCursor}`))).body;assert.deepEqual(rest.items.map(row=>row.version),[2,1]);assert.equal(rest.nextCursor,null);
});
