import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRepository, createQuoteRepository } from './dynamo.mjs';
import { syntheticCatalog } from '../fixtures/catalog.mjs';
import { monthlyPeriod } from './quota.mjs';
function api(respond){const commands=[];return {commands,async send(command){commands.push(command);const response=respond(command,commands);if(response instanceof Error) throw response;return response ?? {};}};}
const cancelled=()=>Object.assign(new Error('transaction contention'),{name:'TransactionCanceledException'});
const conditional=()=>Object.assign(new Error('already initialized'),{name:'ConditionalCheckFailedException'});
const period=monthlyPeriod(new Date('2027-01-20T12:00:00Z'));

test('catalog bootstrap deduplicates legacy versions, excludes archived heads and reads every page strongly',async()=>{
  const client=api(command=>{
    if(command.constructor.name==='GetCommand') return {};
    if(command.constructor.name==='QueryCommand') {
      if(command.input.ExpressionAttributeValues[':prefix']==='HEAD#') return {Items:[{catalogId:'archived',active:false}]};
      return command.input.ExclusiveStartKey ? {Items:[{catalog:{...syntheticCatalog,catalogId:'archived'}},{catalog:{...syntheticCatalog,catalogId:'third'}}]} : {Items:[{catalog:syntheticCatalog},{catalog:{...syntheticCatalog,version:2}}],LastEvaluatedKey:{PK:'ORG#a',SK:'page-2'}};
    }
    return {};
  });
  assert.equal(await createCatalogRepository({client,table:'catalog'}).usage('a'),2);
  const queries=client.commands.filter(command=>command.constructor.name==='QueryCommand');
  assert.equal(queries.length,3);assert.ok(queries.every(command=>command.input.ConsistentRead===true));
  const boot=client.commands.find(command=>command.constructor.name==='PutCommand');
  assert.deepEqual(boot.input.Item,{PK:'ORG#a',SK:'USAGE#CATALOGS',used:2});assert.equal(boot.input.ConditionExpression,'attribute_not_exists(PK)');
});
test('a losing conditional bootstrap returns the winning live counter instead of overwriting it',async()=>{
  let reads=0;const client=api(command=>{
    if(command.constructor.name==='GetCommand') return ++reads===1 ? {} : {Item:{used:5}};
    if(command.constructor.name==='PutCommand') return conditional();
    return {Items:[]};
  });
  assert.equal(await createCatalogRepository({client,table:'catalog'}).usage('a'),5);
  assert.equal(client.commands.filter(command=>command.constructor.name==='PutCommand').length,1);
});
test('a first catalog ID atomically writes version, active head and conditional quota increment',async()=>{
  const client=api(command=>command.input.Key?.SK==='USAGE#CATALOGS' ? {Item:{used:0}} : command.constructor.name==='QueryCommand' ? {Items:[]} : {});
  const result=await createCatalogRepository({client,table:'catalog'}).publish('a',syntheticCatalog,{limit:1});assert.equal(result.created,true);
  const items=client.commands.find(command=>command.constructor.name==='TransactWriteCommand').input.TransactItems;
  assert.equal(items.length,3);assert.equal(items[0].Put.Item.SK,'CATALOG#oficina#VERSION#000000001');
  assert.deepEqual(items[1].Put.Item,{PK:'ORG#a',SK:'HEAD#oficina',catalogId:'oficina',active:true});
  assert.equal(items[2].Update.Key.SK,'USAGE#CATALOGS');assert.equal(items[2].Update.ExpressionAttributeValues[':limit'],1);
  assert.equal(items[2].Update.ExpressionAttributeValues[':delta'],1);
});
test('an archived catalog revision consumes no capacity and stays unavailable for new quotes',async()=>{
  const client=api(command=>command.input.Key?.SK==='USAGE#CATALOGS' ? {Item:{used:1}} : command.input.Key?.SK==='HEAD#oficina' ? {Item:{catalogId:'oficina',active:false}} : {});
  const repository=createCatalogRepository({client,table:'catalog'});
  assert.equal((await repository.publish('a',{...syntheticCatalog,version:2},{limit:1})).created,true);
  assert.ok(!client.commands.some(command=>command.constructor.name==='TransactWriteCommand'));
  assert.equal(await repository.getPublished('a','oficina',2),undefined);
});
test('archive and reactivation atomically update the same head and usage item',async()=>{
  for(const active of [false,true]) {
    const client=api(command=>command.input.Key?.SK==='USAGE#CATALOGS' ? {Item:{used:active ? 0 : 1}} : command.input.Key?.SK==='HEAD#oficina' ? {Item:{catalogId:'oficina',active:!active}} : {});
    await createCatalogRepository({client,table:'catalog'}).setStatus('a','oficina',active,{limit:1});
    const items=client.commands.find(command=>command.constructor.name==='TransactWriteCommand').input.TransactItems;
    assert.equal(items.length,2);assert.equal(items[0].Update.Key.SK,'HEAD#oficina');assert.equal(items[1].Update.Key.SK,'USAGE#CATALOGS');
    assert.equal(items[1].Update.ExpressionAttributeValues[':delta'],active ? 1 : -1);
    assert.equal(items[1].Update.ConditionExpression,active ? '#used < :limit' : '#used >= :one');
  }
});
test('monthly bootstrap uses issuedAt in UTC across all strongly consistent pages',async()=>{
  const client=api(command=>{
    if(command.constructor.name==='QueryCommand') return command.input.ExclusiveStartKey ? {Items:[{quote:{issuedAt:'2027-02-01T00:30:00+01:00'}},{quote:{issuedAt:'2026-12-31T23:59:59Z'}}]} : {Items:[{quote:{issuedAt:'2027-01-10T12:00:00Z'}},{quote:{issuedAt:'2027-02-01T00:00:00Z'}}],LastEvaluatedKey:{PK:'ORG#a',SK:'next'}};
    return {};
  });
  assert.equal(await createQuoteRepository({client,table:'quotes'}).usage('a',period),2);
  const queries=client.commands.filter(command=>command.constructor.name==='QueryCommand');assert.equal(queries.length,2);
  assert.ok(queries.every(command=>command.input.ConsistentRead && command.input.ExpressionAttributeValues[':prefix']==='QUOTE#'));
  assert.deepEqual(client.commands.at(-1).input.Item,{PK:'ORG#a',SK:'USAGE#2027-01',used:2});
});
test('same-key replay is checked again after the winner fills the final quota slot',async()=>{
  let idempotencyReads=0,usageReads=0;const original={quoteId:'original',issuedAt:'2027-01-20T12:00:00Z'};
  const client=api(command=>{
    if(command.constructor.name==='TransactWriteCommand') return cancelled();
    if(command.input.Key?.SK.startsWith('IDEMPOTENCY#')) return ++idempotencyReads<3 ? {} : {Item:{requestHash:'same',quoteId:'original'}};
    if(command.input.Key?.SK.startsWith('USAGE#')) return {Item:{used:++usageReads===1 ? 0 : 1}};
    if(command.input.Key?.SK==='QUOTE#original') return {Item:{quote:original}};
    return {};
  });
  assert.deepEqual(await createQuoteRepository({client,table:'quotes'}).issue('a','same-key','same',{quoteId:'new',issuedAt:'2027-01-20T12:00:00Z'},{limit:1,period}),{quote:original,created:false});
});
test('hot-counter contention retries with the same operation and quota denial remains a known 409',async()=>{
  let transactions=0;const client=api(command=>{
    if(command.constructor.name==='TransactWriteCommand') return ++transactions===1 ? cancelled() : {};
    if(command.input.Key?.SK.startsWith('USAGE#')) return {Item:{used:0}};
    return {};
  });
  assert.equal((await createQuoteRepository({client,table:'quotes'}).issue('a','key','body',{quoteId:'new',issuedAt:'2027-01-20T12:00:00Z'},{limit:1,period})).created,true);
  assert.equal(transactions,2);
  const full=api(command=>command.constructor.name==='TransactWriteCommand' ? cancelled() : command.input.Key?.SK.startsWith('USAGE#') ? {Item:{used:1}} : {});
  await assert.rejects(createQuoteRepository({client:full,table:'quotes'}).issue('a','new','body',{quoteId:'blocked',issuedAt:'2027-01-20T12:00:00Z'},{limit:1,period}),{statusCode:409,code:'PLAN_LIMIT_REACHED'});
});
