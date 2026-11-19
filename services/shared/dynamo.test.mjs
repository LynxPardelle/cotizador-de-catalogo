import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogRepository, createQuoteRepository, createCatalogReader } from './dynamo.mjs';
import { syntheticCatalog } from '../fixtures/catalog.mjs';

function fakeClient(outputs) {
  const commands=[];
  return {commands,async send(command){commands.push(command);const next=outputs.shift();if(next instanceof Error) throw next;return next ?? {};}};
}
const conditional=()=>Object.assign(new Error('conditional'),{name:'ConditionalCheckFailedException'});
const transaction=()=>Object.assign(new Error('transaction'),{name:'TransactionCanceledException'});

test('catalog queries stay in one organization and paginate to latest versions',async()=>{
  const client=fakeClient([{Items:[{catalog:syntheticCatalog}],LastEvaluatedKey:{PK:'ORG#a',SK:'cursor'}},{Items:[{catalog:{...syntheticCatalog,version:2}}]}]);
  const repo=createCatalogRepository({client,table:'catalog'});
  const result=await repo.list('a');
  assert.equal(result[0].version,2);
  assert.equal(client.commands.length,2);
  for(const command of client.commands) {
    assert.equal(command.constructor.name,'QueryCommand');
    assert.equal(command.input.ExpressionAttributeValues[':pk'],'ORG#a');
    assert.equal(command.input.ConsistentRead,true);
  }
  assert.deepEqual(client.commands[1].input.ExclusiveStartKey,{PK:'ORG#a',SK:'cursor'});
});

test('catalog publication is conditional and handles identical and conflicting concurrent publication',async()=>{
  const client=fakeClient([conditional(),{Item:{catalog:syntheticCatalog}}]);
  const repo=createCatalogRepository({client,table:'catalog'});
  assert.equal((await repo.publish('a',syntheticCatalog)).created,false);
  const put=client.commands[0];
  assert.equal(put.constructor.name,'PutCommand');
  assert.match(put.input.ConditionExpression,/attribute_not_exists/);
  assert.equal(put.input.Item.PK,'ORG#a');
  assert.equal(client.commands[1].input.ConsistentRead,true);
  const conflictClient=fakeClient([conditional(),{Item:{catalog:{...syntheticCatalog,name:'different'}}}]);
  await assert.rejects(createCatalogRepository({client:conflictClient,table:'catalog'}).publish('a',syntheticCatalog),{statusCode:409});
});

test('quote snapshot and idempotency record are one atomic conditional transaction',async()=>{
  const client=fakeClient([{}]);
  const repo=createQuoteRepository({client,table:'quotes'});
  const quote={quoteId:'quote-1',totalMinor:'12000',version:1};
  const result=await repo.issue('a','secret-idempotency-key','bodyhash',quote);
  assert.equal(result.created,true);
  const command=client.commands[0];
  assert.equal(command.constructor.name,'TransactWriteCommand');
  assert.equal(command.input.TransactItems.length,2);
  for(const {Put} of command.input.TransactItems) {
    assert.equal(Put.Item.PK,'ORG#a');
    assert.match(Put.ConditionExpression,/attribute_not_exists/);
  }
  assert.equal(command.input.TransactItems[0].Put.Item.quote.totalMinor,'12000');
  assert.equal(command.input.TransactItems[1].Put.Item.requestHash,'bodyhash');
  assert.ok(!JSON.stringify(command.input).includes('secret-idempotency-key'));
});

test('a DynamoDB transaction race returns original snapshot and rejects changed payload',async()=>{
  const original={quoteId:'old',totalMinor:'12000'};
  const client=fakeClient([transaction(),{Item:{requestHash:'same',quoteId:'old'}},{Item:{quote:original}}]);
  const repo=createQuoteRepository({client,table:'quotes'});
  const result=await repo.issue('a','retry','same',{quoteId:'new',totalMinor:'99999'});
  assert.deepEqual(result,{quote:original,created:false});
  assert.equal(client.commands[1].input.Key.PK,'ORG#a');
  assert.equal(client.commands[2].input.Key.SK,'QUOTE#old');
  const conflictClient=fakeClient([transaction(),{Item:{requestHash:'different',quoteId:'old'}}]);
  await assert.rejects(createQuoteRepository({client:conflictClient,table:'quotes'}).issue('a','retry','same',{quoteId:'new'}),{statusCode:409});
});

test('catalog reads cross the Lambda contract and unavailable service is explicit',async()=>{
  const client=fakeClient([{Payload:Buffer.from(JSON.stringify(syntheticCatalog))}]);
  const read=createCatalogReader({client,functionName:'catalog-function'});
  assert.deepEqual(await read('a','oficina',1),syntheticCatalog);
  const command=client.commands[0];
  assert.equal(command.constructor.name,'InvokeCommand');
  assert.equal(command.input.FunctionName,'catalog-function');
  assert.deepEqual(JSON.parse(command.input.Payload.toString()),{operation:'getPublishedCatalog',organizationId:'a',catalogId:'oficina',version:1});
  const unavailable=createCatalogReader({client:fakeClient([{FunctionError:'Unhandled',Payload:Buffer.from('{}')}]),functionName:'catalog-function'});
  await assert.rejects(unavailable('a','oficina',1),{statusCode:503});
});
