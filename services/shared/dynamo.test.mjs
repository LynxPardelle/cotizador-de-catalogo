import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogRepository, createQuoteRepository, createCatalogReader } from './dynamo.mjs';
import { syntheticCatalog } from '../fixtures/catalog.mjs';

function fakeClient(outputs) {
  const commands=[];
  return {commands,async send(command){commands.push(command);const next=typeof outputs==='function' ? outputs(command,commands) : outputs.shift();if(next instanceof Error) throw next;return next ?? {};}};
}
const conditional=()=>Object.assign(new Error('conditional'),{name:'ConditionalCheckFailedException'});
const transaction=()=>Object.assign(new Error('transaction'),{name:'TransactionCanceledException'});

test('catalog queries stay in one organization and paginate to latest versions',async()=>{
  const client=fakeClient(command=>command.input.ExpressionAttributeValues[':prefix']==='HEAD#' ? {Items:[]} : command.input.ExclusiveStartKey ? {Items:[{catalog:{...syntheticCatalog,version:2}}]} : {Items:[{catalog:syntheticCatalog}],LastEvaluatedKey:{PK:'ORG#a',SK:'cursor'}});
  const repo=createCatalogRepository({client,table:'catalog'});
  const result=await repo.list('a');
  assert.equal(result[0].version,2);
  assert.equal(client.commands.length,3);
  for(const command of client.commands) {
    assert.equal(command.constructor.name,'QueryCommand');
    assert.equal(command.input.ExpressionAttributeValues[':pk'],'ORG#a');
    assert.equal(command.input.ConsistentRead,true);
  }
  assert.deepEqual(client.commands.find(command=>command.input.ExclusiveStartKey).input.ExclusiveStartKey,{PK:'ORG#a',SK:'cursor'});
});

test('catalog publication replays before touching capacity and preserves version immutability',async()=>{
  const client=fakeClient([{Item:{catalog:syntheticCatalog}}]);
  const repo=createCatalogRepository({client,table:'catalog'});
  assert.equal((await repo.publish('a',syntheticCatalog)).created,false);
  assert.equal(client.commands[0].constructor.name,'GetCommand');
  assert.equal(client.commands[0].input.ConsistentRead,true);assert.equal(client.commands.length,1);
  const conflictClient=fakeClient([{Item:{catalog:{...syntheticCatalog,name:'different'}}}]);
  await assert.rejects(createCatalogRepository({client:conflictClient,table:'catalog'}).publish('a',syntheticCatalog),{statusCode:409});
});

test('quote snapshot and idempotency record are one atomic conditional transaction',async()=>{
  const client=fakeClient(command=>command.input.Key?.SK.startsWith('USAGE#') ? {Item:{used:0}} : {});
  const repo=createQuoteRepository({client,table:'quotes'});
  const quote={quoteId:'quote-1',totalMinor:'12000',version:1,issuedAt:'2027-01-20T12:00:00Z'};
  const result=await repo.issue('a','secret-idempotency-key','bodyhash',quote,{limit:100});
  assert.equal(result.created,true);
  const command=client.commands.find(command=>command.constructor.name==='TransactWriteCommand');
  assert.equal(command.constructor.name,'TransactWriteCommand');
  assert.equal(command.input.TransactItems.length,3);
  for(const {Put} of command.input.TransactItems.filter(item=>item.Put)) {
    assert.equal(Put.Item.PK,'ORG#a');
    assert.match(Put.ConditionExpression,/attribute_not_exists/);
  }
  assert.equal(command.input.TransactItems[0].Put.Item.quote.totalMinor,'12000');
  assert.equal(command.input.TransactItems[1].Put.Item.requestHash,'bodyhash');
  assert.equal(command.input.TransactItems[2].Update.Key.SK,'USAGE#2027-01');
  assert.equal(command.input.TransactItems[2].Update.ExpressionAttributeValues[':limit'],100);
  assert.ok(!JSON.stringify(command.input).includes('secret-idempotency-key'));
});

test('a DynamoDB transaction race returns original snapshot and rejects changed payload',async()=>{
  const original={quoteId:'old',totalMinor:'12000'};
  let afterRace=false;
  const client=fakeClient(command=>{
    if(command.constructor.name==='TransactWriteCommand'){afterRace=true;return transaction();}
    if(command.input.Key?.SK.startsWith('USAGE#')) return {Item:{used:0}};
    if(command.input.Key?.SK==='QUOTE#old') return {Item:{quote:original}};
    return afterRace ? {Item:{requestHash:'same',quoteId:'old'}} : {};
  });
  const repo=createQuoteRepository({client,table:'quotes'});
  const result=await repo.issue('a','retry','same',{quoteId:'new',totalMinor:'99999',issuedAt:'2027-01-20T12:00:00Z'});
  assert.deepEqual(result,{quote:original,created:false});
  assert.ok(client.commands.filter(command=>command.input.Key).every(command=>command.input.Key.PK==='ORG#a'));
  assert.equal(client.commands.at(-1).input.Key.SK,'QUOTE#old');
  const conflictClient=fakeClient([{Item:{requestHash:'different',quoteId:'old'}}]);
  await assert.rejects(createQuoteRepository({client:conflictClient,table:'quotes'}).issue('a','retry','same',{quoteId:'new',issuedAt:'2027-01-20T12:00:00Z'}),{statusCode:409});
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
