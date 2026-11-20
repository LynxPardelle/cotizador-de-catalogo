import test from 'node:test';import assert from 'node:assert/strict';
import {hash}from'../shared/http.mjs';
const module=await import('./dynamo.mjs').catch(()=>({}));
const ref='11111111-1111-4111-8111-111111111111',mutationId='22222222-2222-4222-8222-222222222222',now=new Date('2026-11-20T12:00:00Z'),expiresAt=1802952000;
const root=()=>({PK:`INTEREST#${ref}`,SK:'RECORD',reference:ref,status:'received',createdAt:'2026-11-19T12:00:00.000Z',expiresAt,requestHash:'intake-hash',record:{requestId:ref,organizationName:'Organization',sector:'Office',contactEmail:'private@example.invalid'}});
const body=()=>({mutationId,expectedVersion:0,status:'reviewing',nextActionDate:'2026-11-25',note:'Call after confirmation'});
const fake=respond=>{const commands=[];return {commands,async send(command){commands.push(command);const result=respond(command,commands);if(result instanceof Error)throw result;return result??{};}};};
function repo(client){assert.equal(typeof module.createApplicationsRepository,'function');return module.createApplicationsRepository({client,table:'own-interest',wait:async()=>{}});}

test('bounded application scan preserves legacy records, excludes private extras and returns scoped continuation',async()=>{
 let page=0;const client=fake(command=>{assert.equal(command.constructor.name,'ScanCommand');assert.equal(command.input.ConsistentRead,true);assert.ok(!command.input.ProjectionExpression.includes('contactEmail'));assert.ok(!command.input.ProjectionExpression.includes('note'));page++;return {Items:page===1?[root()]:[],ScannedCount:25,LastEvaluatedKey:{PK:`DAILY#2026-11-${String(page).padStart(2,'0')}`,SK:'COUNTER'}};});
 const result=await repo(client).list({status:'received',now});assert.equal(result.items.length,1);assert.equal(result.scannedCount,100);assert.equal(client.commands.length,4);assert.ok(result.nextCursor);assert.ok(!JSON.stringify(result).includes('private@example.invalid'));assert.ok(!JSON.stringify(result).includes('intake-hash'));
});
test('a sparse list yields an explicit cursor rather than falsely claiming no more applications',async()=>{
 const client=fake(()=>({Items:[],ScannedCount:25,LastEvaluatedKey:{PK:'DAILY#2026-11-19',SK:'COUNTER'}}));const result=await repo(client).list({status:'all',now});assert.equal(result.items.length,0);assert.ok(result.nextCursor);assert.equal(client.commands.length,4);
});
test('follow-up writes only review metadata and atomically adds history and replay with original deadline',async()=>{
 const original=root();const client=fake(command=>command.constructor.name==='GetCommand'&&command.input.Key.SK==='RECORD'?{Item:original}:{});const result=await repo(client).update(ref,body(),{actorKey:'a'.repeat(64),now});assert.equal(result.review.version,1);
 const tx=client.commands.find(x=>x.constructor.name==='TransactWriteCommand').input.TransactItems;assert.equal(tx.length,3);assert.ok(tx.every(x=>(x.Update??x.Put).TableName==='own-interest'));
 assert.equal(tx[0].Update.UpdateExpression,'SET #review = :review');assert.match(tx[0].Update.ConditionExpression,/attribute_not_exists/);assert.match(tx[0].Update.ConditionExpression,/#expiresAt > :now/);assert.ok(!Object.keys(tx[0].Update.ExpressionAttributeValues).includes(':expectedVersion'));
 assert.equal(tx[1].Put.Item.SK,'REVIEW#000000000001');assert.equal(tx[2].Put.Item.SK,`REPLAY#${mutationId}`);for(const entry of tx.slice(1)){assert.equal(entry.Put.Item.expiresAt,expiresAt);assert.match(entry.Put.ConditionExpression,/attribute_not_exists/);}
 assert.equal(tx[1].Put.Item.event.previousStatus,'received');assert.equal(tx[1].Put.Item.event.actorKey,'a'.repeat(64));assert.deepEqual(original,root());assert.ok(!JSON.stringify(tx).includes('private@example.invalid'));assert.ok(!JSON.stringify(tx).includes('intake-hash'));
});
test('committed replay returns the first result and changed content conflicts without another transaction',async()=>{
 const result={reference:ref,review:{status:'reviewing',version:1,nextActionDate:'2026-11-25',updatedAt:now.toISOString()}};const client=fake(command=>({Item:command.input.Key.SK==='RECORD'?root():{requestHash:hash(body()),result,expiresAt}}));
 assert.deepEqual(await repo(client).update(ref,body(),{actorKey:'a'.repeat(64),now}),result);await assert.rejects(repo(client).update(ref,{...body(),note:'changed'},{actorKey:'a'.repeat(64),now}),{statusCode:409,code:'CONFLICT'});assert.ok(client.commands.every(x=>x.constructor.name==='GetCommand'));
});
test('the root expiry is checked before a committed replay can expose a review',async()=>{
 const client=fake(()=>({Item:{...root(),expiresAt:Math.floor(now.getTime()/1000)}}));await assert.rejects(repo(client).update(ref,body(),{actorKey:'a'.repeat(64),now}),{statusCode:404});assert.equal(client.commands.length,1);
});
test('concurrent optimistic winner creates a conflict and an identical mutation returns its committed result',async()=>{
 for(const identical of [false,true]){
  let won=false;const result={reference:ref,review:{status:'reviewing',version:1,updatedAt:now.toISOString(),nextActionDate:''}};
  const client=fake(command=>{if(command.constructor.name==='TransactWriteCommand'){won=true;return Object.assign(new Error(),{name:'TransactionCanceledException'});}if(command.input.Key.SK==='RECORD')return {Item:{...root(),...(won?{review:result.review}:{})}};return won&&identical?{Item:{requestHash:hash(body()),result,expiresAt}}:{};});
  if(identical)assert.deepEqual(await repo(client).update(ref,body(),{actorKey:'a'.repeat(64),now}),result);else await assert.rejects(repo(client).update(ref,body(),{actorKey:'a'.repeat(64),now}),{statusCode:409,code:'REVIEW_CONFLICT'});
  assert.equal(client.commands.filter(x=>x.constructor.name==='TransactWriteCommand').length,1);
 }
});
test('history is strongly queried within one request partition in reverse order and does not expose extra fields',async()=>{
 const event={mutationId,version:1,previousStatus:'received',status:'reviewing',previousNextActionDate:'',nextActionDate:'',note:'Checked',actorKey:'a'.repeat(64),createdAt:now.toISOString(),contactEmail:'private@example.invalid'};
 const client=fake(command=>command.constructor.name==='GetCommand'?{Item:root()}:{Items:[{event}],LastEvaluatedKey:{PK:`INTEREST#${ref}`,SK:'REVIEW#000000000001'}});
 const result=await repo(client).history(ref,{now});assert.equal(result.items.length,1);assert.ok(result.nextCursor);assert.ok(!JSON.stringify(result).includes('private@example.invalid'));const query=client.commands.find(x=>x.constructor.name==='QueryCommand').input;assert.equal(query.ScanIndexForward,false);assert.equal(query.ConsistentRead,true);assert.equal(query.Limit,20);assert.equal(query.ExpressionAttributeValues[':pk'],`INTEREST#${ref}`);assert.equal(query.ExpressionAttributeValues[':prefix'],'REVIEW#');
});
test('persistent canceled updates are bounded and cannot return a partial audit result',async()=>{
 const client=fake(command=>command.constructor.name==='TransactWriteCommand'?Object.assign(new Error(),{name:'TransactionCanceledException'}):command.input.Key.SK==='RECORD'?{Item:root()}:{});
 await assert.rejects(repo(client).update(ref,body(),{actorKey:'a'.repeat(64),now}),{statusCode:503,code:'REVIEW_BUSY'});assert.equal(client.commands.filter(x=>x.constructor.name==='TransactWriteCommand').length,5);
});
