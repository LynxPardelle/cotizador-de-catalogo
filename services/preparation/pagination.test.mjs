import test from 'node:test';import assert from 'node:assert/strict';
import {decodeCursor,encodeCursor} from '../applications/domain.mjs';
import {createMemoryPreparationRepository} from './memory.mjs';
import {historyQuery} from './domain.mjs';
const reference='11111111-1111-4111-8111-111111111111';
test('applications list cursors recognize preparation keys but history cursors cannot cross domains or references',()=>{
 for(const SK of ['PREP_HISTORY#000000000001','PREP_REPLAY#22222222-2222-4222-8222-222222222222']){const key={PK:`INTEREST#${reference}`,SK};const encoded=encodeCursor(key,{kind:'list',status:'all'});assert.deepEqual(decodeCursor(encoded,{kind:'list',status:'all'}),key);}
 const cursor=encodeCursor({PK:`INTEREST#${reference}`,SK:'PREP_HISTORY#000000000020'},{kind:'preparation-history',reference});assert.ok(historyQuery({rawQueryString:`cursor=${cursor}`},reference).cursor);
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 for(const key of [{PK:`INTEREST#${reference}`,SK:'REVIEW#000000000020'},{PK:'INTEREST#33333333-3333-4333-8333-333333333333',SK:'PREP_HISTORY#000000000020'},{PK:`INTEREST#${reference}`,SK:'PREP_REPLAY#22222222-2222-4222-8222-222222222222'}])assert.throws(()=>historyQuery({rawQueryString:`cursor=${encode({v:1,kind:'preparation-history',reference,key})}`},reference),{statusCode:400});
 assert.throws(()=>decodeCursor(encode({v:1,kind:'list',status:'all',key:{PK:`INTEREST#${reference}`,SK:'PREP_HISTORY#arbitrary'}}),{kind:'list',status:'all'}),{statusCode:400});
});
test('preparation history continues after twenty events without duplicates and cannot show expired source',async()=>{
 const now=new Date('2026-11-20T12:00:00Z'),expiresAt=Math.floor(now.getTime()/1000)+1000,PK=`INTEREST#${reference}`,root={PK,SK:'RECORD',reference,createdAt:now.toISOString(),expiresAt,record:{requestId:reference},review:{status:'selected',version:1,updatedAt:now.toISOString(),nextActionDate:''}},itemsMap=new Map([[`${PK}/RECORD`,root]]);
 for(let version=1;version<=22;version++){const SK=`PREP_HISTORY#${String(version).padStart(12,'0')}`;itemsMap.set(`${PK}/${SK}`,{PK,SK,expiresAt,event:{version,kind:'link',mutationId:`${String(version).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,actorKey:'derived',createdAt:now.toISOString(),workspaceId:'org-consented',consentVersion:'2026-11-19'}});}
 const repository=createMemoryPreparationRepository({itemsMap}),first=await repository.history(reference,{now});assert.equal(first.items.length,20);assert.equal(first.items[0].version,22);const cursor=historyQuery({rawQueryString:`cursor=${first.nextCursor}`},reference).cursor;const second=await repository.history(reference,{now,cursor});assert.deepEqual(second.items.map(event=>event.version),[2,1]);assert.equal(second.nextCursor,null);await assert.rejects(repository.history(reference,{now:new Date(expiresAt*1000)}),{statusCode:404});
});
