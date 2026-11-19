import test from 'node:test';
import assert from 'node:assert/strict';
import { createDynamoTeamRepository } from './dynamo.mjs';
const subject='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const member={subject,organizationId:'org-a',role:'admin',email:'owner@example.invalid',joinedAt:'2026-11-20T12:00:00.000Z'};
function client(outputs){const commands=[];return {commands,async send(command){commands.push(command);if(command.constructor.name==='GetCommand' && command.input.Key.SK==='META') return {Item:{adminCount:1,memberCount:1}};const next=outputs.shift();if(next instanceof Error) throw next;if(command.constructor.name==='GetCommand') return {Item:next};return next ?? {};}};}
const transaction=api=>api.commands.find(command=>command.constructor.name==='TransactWriteCommand');
const cancelled=()=>Object.assign(new Error('conditional failure'),{name:'TransactionCanceledException'});

test('initial membership and durable migration marker share a conditional atomic transaction',async()=>{
  const api=client([{}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  assert.equal(await repo.initialize(subject,member.email,[member]),true);
  const action=transaction(api);assert.equal(action.constructor.name,'TransactWriteCommand');
  const items=action.input.TransactItems;assert.equal(items.length,4);
  assert.deepEqual(items[0].Put.Item,{PK:`USER#${subject}`,SK:'PROFILE',profile:{subject,email:member.email,defaultOrganizationId:'org-a'}});
  assert.match(items[0].Put.ConditionExpression,/attribute_not_exists/);
  assert.equal(items[1].Put.Item.PK,`USER#${subject}`);assert.equal(items[1].Put.Item.SK,'ORG#org-a');
  assert.equal(items[2].Put.Item.PK,'ORG#org-a');assert.equal(items[2].Put.Item.SK,`MEMBER#${subject}`);
  assert.equal(items[3].Update.ExpressionAttributeValues[':delta'],1);
  const retryClient=client([cancelled(),{profile:{subject,email:member.email}}]);
  assert.equal(await createDynamoTeamRepository({client:retryClient,table:'members'}).initialize(subject,member.email,[member]),false);
});
test('membership reads use strongly consistent user and organization partitions without an index',async()=>{
  const api=client([{Items:[{member}]},{Items:[{member}]}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  assert.deepEqual(await repo.memberships(subject),[member]);assert.deepEqual(await repo.members('org-a'),[member]);
  assert.equal(api.commands[0].input.ExpressionAttributeValues[':pk'],`USER#${subject}`);
  assert.equal(api.commands[1].input.ExpressionAttributeValues[':pk'],'ORG#org-a');
  assert.ok(api.commands.every(command=>command.input.ConsistentRead===true && !command.input.IndexName));
});
test('last-admin downgrade uses conditional counter and avoids duplicate transaction keys for self-change',async()=>{
  const api=client([{member},{member},cancelled(),{member},{adminCount:1}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  await assert.rejects(repo.changeRole('org-a',subject,subject,'reader'),{code:'LAST_ADMIN',statusCode:409});
  const items=transaction(api).input.TransactItems;assert.equal(items.length,3);
  assert.equal(items[2].Update.ConditionExpression,'adminCount > :one');assert.equal(items[2].Update.ExpressionAttributeValues[':delta'],-1);
  assert.equal(items[0].Put.ExpressionAttributeValues[':oldRole'],'admin');
  assert.ok(!items.some(item=>item.ConditionCheck),'Self change already conditions the caller membership in its Put.');
});
test('granting admin checks the caller role in the same transaction and increments count once',async()=>{
  const reader={...member,subject:other,role:'reader'};
  const api=client([{member:reader},{member},{}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  const result=await repo.changeRole('org-a',subject,other,'admin');assert.equal(result.role,'admin');
  const items=transaction(api).input.TransactItems;
  assert.equal(items[2].ConditionCheck.Key.PK,`USER#${subject}`);
  assert.equal(items[2].ConditionCheck.ExpressionAttributeValues[':admin'],'admin');
  assert.equal(items[3].Update.ExpressionAttributeValues[':delta'],1);
});
test('removing a member deletes both mirrors while keeping the no-remigration marker',async()=>{
  const reader={...member,subject:other,role:'reader'};
  const api=client([{member:reader},{member},{}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  await repo.removeMember('org-a',subject,other);
  const items=transaction(api).input.TransactItems;
  assert.equal(items.filter(item=>item.Delete).length,2);
  assert.ok(items.every(item=>item.Delete?.Key.SK!=='PROFILE'));
  assert.ok(items.some(item=>item.ConditionCheck?.ExpressionAttributeValues[':admin']==='admin'));
});
test('invitation acceptance is atomic with email, expiry and unused-token conditions',async()=>{
  const invitation={tokenHash:'hash-only',organizationId:'org-a',email:'other@example.invalid',role:'admin',createdBy:subject,expiresAt:'2026-11-27T12:00:00.000Z'};
  const api=client([{invitation},{},{}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  const accepted=await repo.acceptInvitation('hash-only',other,invitation.email,new Date('2026-11-20T12:00:00.000Z'));
  assert.equal(accepted.subject,other);assert.equal(accepted.role,'admin');
  const items=transaction(api).input.TransactItems;
  assert.match(items[0].Put.ConditionExpression,/attribute_not_exists.*acceptedBy/);
  assert.match(items[0].Put.ConditionExpression,/#invitation.email = :email/);
  assert.match(items[0].Put.ConditionExpression,/#invitation.expiresAt > :now/);
  assert.equal(items[0].Put.ExpressionAttributeValues[':email'],invitation.email);
  assert.equal(items[3].Update.ExpressionAttributeValues[':delta'],1);
  assert.equal(items[3].Update.ExpressionAttributeValues[':membersDelta'],1);
  assert.equal(items[3].Update.ExpressionAttributeValues[':limit'],2);
  assert.match(items[3].Update.ConditionExpression,/memberCount < :limit/);
  assert.match(items[3].Update.ConditionExpression,/planId = :planId/);
  assert.equal(items[3].Update.ExpressionAttributeValues[':planId'],'esencial');
  assert.match(items[3].Update.UpdateExpression,/memberCount/);
});
test('used invitation cannot resurrect a removed user in DynamoDB',async()=>{
  const invitation={organizationId:'org-a',email:'other@example.invalid',role:'admin',acceptedBy:other,expiresAt:'2026-11-27T12:00:00.000Z'};
  const api=client([{invitation},{}]);const repo=createDynamoTeamRepository({client:api,table:'members'});
  await assert.rejects(repo.acceptInvitation('hash',other,invitation.email,new Date('2026-11-20T12:00:00Z')),{code:'INVITATION_ALREADY_USED'});
  assert.ok(api.commands.every(command=>command.constructor.name==='GetCommand'));
});

test('quota bootstrap reads every strongly consistent membership page and preserves existing admin and plan fields',async()=>{
  const commands=[];const api={async send(command){commands.push(command);
    if(command.constructor.name==='GetCommand') return {Item:{adminCount:3,planId:'equipo'}};
    if(command.constructor.name==='QueryCommand') return command.input.ExclusiveStartKey ? {Items:[{member:{...member,subject:other}}]} : {Items:[{member}],LastEvaluatedKey:{PK:'ORG#org-a',SK:'cursor'}};
    if(command.constructor.name==='UpdateCommand') return {Attributes:{adminCount:3,planId:'equipo',memberCount:2}};
    throw new Error('Unexpected command');
  }};
  const repo=createDynamoTeamRepository({client:api,table:'members'});
  assert.equal(typeof repo.memberCount,'function');assert.equal(await repo.memberCount('org-a'),2);
  const update=commands.find(command=>command.constructor.name==='UpdateCommand').input;
  assert.equal(update.UpdateExpression,'SET memberCount = :count');assert.equal(update.ConditionExpression,'attribute_not_exists(memberCount)');
  assert.equal(update.ExpressionAttributeValues[':count'],2);
  assert.ok(commands.filter(command=>command.constructor.name==='QueryCommand').every(command=>command.input.ConsistentRead));
});

test('losing a concurrent counter bootstrap uses the winning count without overwriting newer members',async()=>{
  let metadataReads=0;const commands=[];
  const api={async send(command){commands.push(command);
    if(command.constructor.name==='GetCommand') return {Item:++metadataReads===1 ? {adminCount:1} : {adminCount:1,memberCount:3}};
    if(command.constructor.name==='QueryCommand') return {Items:[{member}]};
    if(command.constructor.name==='UpdateCommand') throw Object.assign(new Error('another writer initialized'),{name:'ConditionalCheckFailedException'});
  }};
  assert.equal(await createDynamoTeamRepository({client:api,table:'members'}).memberCount('org-a'),3);
  assert.equal(commands.filter(command=>command.constructor.name==='UpdateCommand').length,1);
});

test('a seat consumed concurrently aborts acceptance and is reported as a quota conflict on retry',async()=>{
  const invitation={tokenHash:'hash-only',organizationId:'org-a',email:'other@example.invalid',role:'reader',createdBy:subject,expiresAt:'2026-11-27T12:00:00.000Z'};
  let count=1,transactions=0;
  const api={async send(command){
    if(command.constructor.name==='GetCommand') {
      if(command.input.Key.SK==='META') return {Item:{adminCount:1,memberCount:count}};
      if(command.input.Key.SK==='INVITE') return {Item:{invitation}};
      return {};
    }
    if(command.constructor.name==='TransactWriteCommand') {transactions++;count=2;throw cancelled();}
    throw new Error('Unexpected command');
  }};
  await assert.rejects(createDynamoTeamRepository({client:api,table:'members'}).acceptInvitation('hash-only',other,invitation.email,new Date('2026-11-20T12:00:00Z')),{code:'PLAN_LIMIT_REACHED',statusCode:409});
  assert.equal(transactions,1);assert.equal(invitation.acceptedBy,undefined);
});
