import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuoteRepository } from './dynamo.mjs';
import { hash } from './http.mjs';
import { pilotWindow, summarizePilotMetrics } from '../quoting/domain/pilot-metrics.mjs';
const actorKey='a'.repeat(64);
const quoteId='11111111-1111-4111-8111-111111111111';
const correctionId='22222222-2222-4222-8222-222222222222';
const flowId='33333333-3333-4333-8333-333333333333';
const quote={quoteId,issuedAt:'2027-01-20T12:00:00.000Z',totalMinor:'450000'};
const correction={quoteId,correctionId,reason:'quantity',reportedAt:'2027-01-20T13:00:00.000Z'};
function api(respond){const commands=[];return {commands,async send(command){commands.push(command);const result=respond(command,commands);if(result instanceof Error) throw result;return result ?? {};}};}
test('actor pseudonym is private item metadata and never part of the returned proposal snapshot',async()=>{
  const client=api(command=>command.input.Key?.SK.startsWith('USAGE#') ? {Item:{used:0}} : {});
  await createQuoteRepository({client,table:'quotes'}).issue('org-a','key','commercial-hash',quote,{limit:100,actorKey});
  const item=client.commands.find(command=>command.constructor.name==='TransactWriteCommand').input.TransactItems[0].Put.Item;
  assert.equal(item.actorKey,actorKey);assert.deepEqual(item.quote,quote);assert.ok(!Object.hasOwn(item.quote,'actorKey'));
  const getClient=api(()=>({Item:{...item,actorKey}}));
  assert.deepEqual(await createQuoteRepository({client:getClient,table:'quotes'}).get('org-a',quoteId),quote);
});
test('correction event, idempotency result and existing-quote guard share one transaction without quota updates',async()=>{
  const client=api(command=>command.input.Key?.SK===`QUOTE#${quoteId}` ? {Item:{quote}} : {});
  const result=await createQuoteRepository({client,table:'quotes'}).reportCorrection('org-a',quoteId,correction);
  assert.equal(result.created,true);
  const items=client.commands.find(command=>command.constructor.name==='TransactWriteCommand').input.TransactItems;
  assert.equal(items.length,3);assert.ok(items.every(item=>!item.Update));
  assert.ok(items[0].Put.Item.SK.startsWith(`CORRECTION#${correction.reportedAt}#`));
  assert.equal(items[1].Put.Item.SK,`IDEMCORRECTION#${quoteId}#${correctionId}`);
  assert.equal(items[2].ConditionCheck.Key.SK,`QUOTE#${quoteId}`);
  assert.match(items[2].ConditionCheck.ConditionExpression,/attribute_exists/);
  assert.ok(!JSON.stringify(items).includes('USAGE#'));
});
test('correction replay preserves its original date and a reason change conflicts',async()=>{
  const requestHash=hash({quoteId,correctionId,reason:'quantity'});
  const client=api(()=>({Item:{requestHash,correction}}));
  const repository=createQuoteRepository({client,table:'quotes'});
  assert.deepEqual(await repository.reportCorrection('org-a',quoteId,{...correction,reportedAt:'2027-01-21T13:00:00.000Z'}),{correction,created:false});
  await assert.rejects(repository.reportCorrection('org-a',quoteId,{...correction,reason:'other'}),{statusCode:409});
  assert.ok(client.commands.every(command=>command.constructor.name==='GetCommand'));
});
test('a concurrent correction retry returns the committed event instead of duplicating it',async()=>{
  let committed=false;
  const client=api(command=>{
    if(command.constructor.name==='TransactWriteCommand') {committed=true;return Object.assign(new Error('another retry won'),{name:'TransactionCanceledException'});}
    if(command.input.Key?.SK===`QUOTE#${quoteId}`) return {Item:{quote}};
    return committed ? {Item:{requestHash:hash({quoteId,correctionId,reason:'quantity'}),correction}} : {};
  });
  assert.deepEqual(await createQuoteRepository({client,table:'quotes'}).reportCorrection('org-a',quoteId,correction),{correction,created:false});
  assert.equal(client.commands.filter(command=>command.constructor.name==='TransactWriteCommand').length,1);
});
test('a quote outside the organization cannot receive a correction event',async()=>{
  const client=api(()=>({}));
  await assert.rejects(createQuoteRepository({client,table:'quotes'}).reportCorrection('other-org',quoteId,correction),{statusCode:404});
  assert.ok(client.commands.every(command=>command.constructor.name==='GetCommand' && command.input.Key.PK==='ORG#other-org'));
});
test('metrics query all quote pages and a bounded correction range with minimized projections and no scan',async()=>{
  const window=pilotWindow(7,new Date('2027-01-20T14:00:00Z'));
  const client=api(command=>{
    assert.equal(command.constructor.name,'QueryCommand');
    if(command.input.ExpressionAttributeValues[':prefix']==='QUOTE#') {
      return command.input.ExclusiveStartKey ? {Items:[{quote:{quoteId:'legacy',issuedAt:'2027-01-19T12:00:00Z'}}]} : {Items:[{quote:{...quote,pilot:{flowId,activeDurationMs:60000,adjustments:2}},actorKey}],LastEvaluatedKey:{PK:'ORG#org-a',SK:'QUOTE#next'}};
    }
    return command.input.ExclusiveStartKey ? {Items:[{correction:{...correction,reason:'pricing',reportedAt:'2027-01-14T00:00:00.000Z'}}]} : {Items:[{correction}],LastEvaluatedKey:{PK:'ORG#org-a',SK:'CORRECTION#next'}};
  });
  const result=await createQuoteRepository({client,table:'quotes'}).metrics('org-a',window);
  assert.equal(result.totalIssued,2);assert.equal(result.time.sampleSize,1);assert.equal(result.time.missingCount,1);
  assert.equal(result.activeIssuers,1);assert.equal(result.missingIssuerCount,1);assert.equal(result.corrections.total,2);
  assert.equal(client.commands.length,4);
  for(const command of client.commands) {
    assert.equal(command.input.ExpressionAttributeValues[':pk'],'ORG#org-a');assert.equal(command.input.ConsistentRead,true);
    assert.ok(command.input.ProjectionExpression);assert.ok(!command.input.ProjectionExpression.includes('totalMinor'));
  }
  const correctionQuery=client.commands.find(command=>command.input.KeyConditionExpression.includes('BETWEEN'));
  assert.equal(correctionQuery.input.ExpressionAttributeValues[':start'],`CORRECTION#${window.startsAt}`);
  assert.equal(correctionQuery.input.ExpressionAttributeValues[':end'],`CORRECTION#${window.endsAt}`);
  assert.ok(!JSON.stringify(result).includes(actorKey));assert.ok(!JSON.stringify(result).includes('450000'));
});
test('zero is a real timing sample, median uses the ordered sample and missing legacy time is explicit',()=>{
  const records=[0,10,20].map((duration,index)=>({quote:{quoteId:`q${index}`,issuedAt:quote.issuedAt,pilot:{flowId,activeDurationMs:duration,adjustments:0}},actorKey}));
  records.push({quote:{quoteId:'legacy',issuedAt:quote.issuedAt}});
  const result=summarizePilotMetrics(records,[],pilotWindow(7,new Date('2027-01-20T14:00:00Z')));
  assert.deepEqual(result.time,{sampleSize:3,missingCount:1,meanMs:10,medianMs:10});
  assert.equal(result.totalIssued,4);
});
test('corrupt dates fail explicitly instead of reporting a false empty legacy history',()=>{
  assert.throws(()=>summarizePilotMetrics([{quote:{quoteId:'corrupt'}}],[],pilotWindow(7,new Date('2027-01-20T14:00:00Z'))),{statusCode:503,code:'METRICS_UNAVAILABLE'});
});

test('metrics page budget is shared by quote and correction pagination and never returns a partial aggregate',async()=>{
  let quotePages=0;
  const client=api(command=>{
    if(command.input.ExpressionAttributeValues[':prefix']==='QUOTE#') return {Items:[{quote}],...(++quotePages<3 ? {LastEvaluatedKey:{PK:'ORG#org-a',SK:`QUOTE#page${quotePages}`}} : {})};
    return {Items:[]};
  });
  const repository=createQuoteRepository({client,table:'quotes',metricsBudget:{maxPages:2,maxRecords:100,deadlineMs:6000}});
  await assert.rejects(repository.metrics('org-a',pilotWindow(7,new Date('2027-01-20T14:00:00Z'))),{statusCode:503,code:'METRICS_LIMIT'});
});
test('metrics record budget stops an oversized history instead of silently truncating the sample',async()=>{
  const client=api(command=>command.input.ExpressionAttributeValues[':prefix']==='QUOTE#' ? {Items:Array.from({length:3},(_,i)=>({quote:{...quote,quoteId:`q${i}`}}))} : {Items:[]});
  const repository=createQuoteRepository({client,table:'quotes',metricsBudget:{maxPages:100,maxRecords:2,deadlineMs:6000}});
  await assert.rejects(repository.metrics('org-a',pilotWindow(7,new Date('2027-01-20T14:00:00Z'))),{statusCode:503,code:'METRICS_LIMIT'});
});
test('metrics deadline is checked after each read before any result can be returned',async()=>{
  let now=0;const client=api(()=>{now=10;return {Items:[]};});
  const repository=createQuoteRepository({client,table:'quotes',metricsBudget:{maxPages:100,maxRecords:100,deadlineMs:5},metricsNow:()=>now});
  await assert.rejects(repository.metrics('org-a',pilotWindow(7,new Date('2027-01-20T14:00:00Z'))),{statusCode:503,code:'METRICS_LIMIT'});
});
