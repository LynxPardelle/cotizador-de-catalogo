import test from 'node:test';
import assert from 'node:assert/strict';
const {createInterestRepository}=await import('./dynamo.mjs').catch(()=>({}));
const requestId='11111111-1111-4111-8111-111111111111';
const record={requestId,organizationName:'Synthetic organization',contactEmail:'synthetic@example.invalid',sector:'Office',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19',status:'received',createdAt:'2026-11-19T12:00:00.000Z',acceptedAt:'2026-11-19T12:00:00.000Z',expiresAt:1802952000};
const period={day:'2026-11-19',expiresAt:1795305600,retryAfter:43200};
const cancellation=()=>Object.assign(new Error('transaction conditions changed'),{name:'TransactionCanceledException'});
function fake(respond){const commands=[];return {commands,async send(command){commands.push(command);const result=respond(command,commands);if(result instanceof Error)throw result;return result??{};}};}
function repository(client){assert.equal(typeof createInterestRepository,'function');return createInterestRepository({client,table:'interest',wait:async()=>{}});}
test('interest DynamoDB repository exists and requires its own table',()=>{
  assert.equal(typeof createInterestRepository,'function');assert.throws(()=>createInterestRepository({table:''}));
});
test('receipt and capacity commit atomically in the same own-table transaction with fixed retention metadata',async()=>{
  const client=fake(()=>({}));const result=await repository(client).submit(record,'hash',{period,limit:200});assert.deepEqual(result,{reference:requestId,status:'received'});
  const transaction=client.commands.find(command=>command.constructor.name==='TransactWriteCommand').input.TransactItems;
  assert.equal(transaction.length,2);assert.ok(transaction.every(item=>(item.Put??item.Update).TableName==='interest'));
  const stored=transaction[0].Put;assert.equal(stored.Item.PK,`INTEREST#${requestId}`);assert.equal(stored.Item.SK,'RECORD');assert.equal(stored.Item.reference,requestId);assert.equal(stored.Item.createdAt,record.createdAt);assert.equal(stored.Item.expiresAt,record.expiresAt);assert.equal(stored.Item.status,'received');assert.deepEqual(stored.Item.record,record);assert.equal(stored.Item.requestHash,'hash');assert.match(stored.ConditionExpression,/attribute_not_exists/);
  const quota=transaction[1].Update;assert.deepEqual(quota.Key,{PK:'DAILY#2026-11-19',SK:'COUNTER'});assert.match(quota.UpdateExpression,/ADD #used :one/);assert.match(quota.ConditionExpression,/#used < :limit/);assert.equal(quota.ExpressionAttributeValues[':limit'],200);assert.equal(quota.ExpressionAttributeValues[':expiresAt'],period.expiresAt);
});
test('committed identical retry is private, strongly consistent and bypasses further quota writes',async()=>{
  const client=fake(()=>({Item:{requestHash:'hash',record}}));const result=await repository(client).submit({...record,createdAt:'later'},'hash',{period,limit:1});assert.deepEqual(result,{reference:requestId,status:'received'});
  assert.equal(client.commands.length,1);assert.equal(client.commands[0].constructor.name,'GetCommand');assert.equal(client.commands[0].input.ConsistentRead,true);assert.deepEqual(client.commands[0].input.Key,{PK:`INTEREST#${requestId}`,SK:'RECORD'});assert.ok(!JSON.stringify(result).includes(record.contactEmail));
});
test('a changed payload on the same reference conflicts before reading or changing capacity',async()=>{
  const client=fake(()=>({Item:{requestHash:'other',record}}));await assert.rejects(repository(client).submit(record,'changed',{period,limit:200}),{statusCode:409,code:'CONFLICT'});assert.equal(client.commands.length,1);
});
test('a cancelled concurrent replay returns the already committed receipt without another record',async()=>{
  let committed=false;const client=fake(command=>{
    if(command.constructor.name==='TransactWriteCommand'){committed=true;return cancellation();}
    return committed?{Item:{requestHash:'hash',record}}:{};
  });assert.deepEqual(await repository(client).submit(record,'hash',{period,limit:200}),{reference:requestId,status:'received'});assert.equal(client.commands.filter(command=>command.constructor.name==='TransactWriteCommand').length,1);
});
test('a full daily counter rejects a new reference after confirming it was not committed',async()=>{
  const client=fake(command=>command.constructor.name==='TransactWriteCommand'?cancellation():command.input.Key.PK.startsWith('DAILY#')?{Item:{used:200}}:{});
  await assert.rejects(repository(client).submit(record,'hash',{period,limit:200}),{statusCode:429,code:'INTEREST_LIMIT_REACHED'});
  assert.equal(client.commands.filter(command=>command.constructor.name==='TransactWriteCommand').length,1);assert.ok(client.commands.every(command=>command.input.TableName==='interest'||command.input.TransactItems));
});
test('persistent capacity contention is bounded and fails without partial receipt',async()=>{
  const client=fake(command=>command.constructor.name==='TransactWriteCommand'?cancellation():command.input.Key.PK.startsWith('DAILY#')?{Item:{used:1}}:{});
  await assert.rejects(repository(client).submit(record,'hash',{period,limit:200}),{statusCode:503,code:'INTEREST_BUSY'});assert.equal(client.commands.filter(command=>command.constructor.name==='TransactWriteCommand').length,5);
});
test('malformed capacity state fails closed without returning a false success or retrying a damaged counter',async()=>{
  for(const used of [-1,1.5,'1',undefined]){
    const client=fake(command=>command.constructor.name==='TransactWriteCommand'?cancellation():command.input.Key.PK.startsWith('DAILY#')?{Item:{used}}:{});
    await assert.rejects(repository(client).submit(record,'hash',{period,limit:200}),{statusCode:503,code:'INTEREST_BUSY'});assert.equal(client.commands.filter(command=>command.constructor.name==='TransactWriteCommand').length,1);
  }
});
