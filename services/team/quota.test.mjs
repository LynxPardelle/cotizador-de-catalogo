import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamHandler } from './index.mjs';
import { createMemoryTeamRepository } from './memory.mjs';
const subjects=[1,2,3].map(n=>`${n}`.repeat(8)+'-'+`${n}`.repeat(4)+'-4'+`${n}`.repeat(3)+'-8'+`${n}`.repeat(3)+'-'+`${n}`.repeat(12));
const [a,b,c]=subjects;
const event=(subject,method,path,body)=>({rawPath:`/api/v1/team${path}`,headers:{'x-organization-id':'org-a'},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{http:{method},authorizer:{jwt:{claims:{sub:subject,token_use:'access'}}}}});
const parse=r=>JSON.parse(r.body);
function setup(){
  const repository=createMemoryTeamRepository();let sequence=0;
  const users={get:async subject=>({subject,email:`${subject[0]}@example.invalid`,emailVerified:true}),groups:async subject=>subject===a ? ['org:org-a:admin'] : []};
  const handler=createTeamHandler({repository,users,newToken:()=>`${++sequence}`.repeat(43),clock:()=>new Date('2026-11-19T12:00:00Z')});
  return {repository,handler};
}
test('context and private authorization expose server entitlements and usage counts the owner',async()=>{
  const {handler}=setup();const context=parse(await handler(event(a,'GET','/context')));
  assert.equal(context.plan?.id,'esencial');
  const auth=await handler({operation:'authorizeMembership',subject:a,organizationId:'org-a'});
  assert.equal(auth.plan.limits.members,2);
  const response=await handler(event(a,'GET','/usage'));assert.equal(response.statusCode,200);
  assert.deepEqual(parse(response).members,{used:1,limit:2,remaining:1,state:'normal'});
  assert.equal(parse(response).billingEnabled,false);assert.equal(parse(response).limitsEnforced,true);
});
test('two concurrent acceptances share one available seat; retry is free and removal releases capacity',async()=>{
  const {handler}=setup();
  const tokens=[];for(const subject of [b,c]) tokens.push(parse(await handler(event(a,'POST','/invitations',{email:`${subject[0]}@example.invalid`,role:'seller'}))).token);
  const accepted=await Promise.all([b,c].map((subject,i)=>handler(event(subject,'POST',`/invitations/${tokens[i]}/accept`,{}))));
  assert.deepEqual(accepted.map(r=>r.statusCode).sort(),[200,409]);
  const winner=accepted.findIndex(r=>r.statusCode===200);const loser=1-winner;
  assert.equal(parse(accepted[loser]).error.code,'PLAN_LIMIT_REACHED');
  assert.equal((await handler(event([b,c][winner],'POST',`/invitations/${tokens[winner]}/accept`,{}))).statusCode,200);
  assert.deepEqual(parse(await handler(event(a,'GET','/usage'))).members,{used:2,limit:2,remaining:0,state:'limit'});
  assert.equal((await handler(event(a,'POST','/invitations',{email:'new@example.invalid',role:'reader'}))).statusCode,409);
  assert.equal((await handler(event(a,'DELETE',`/members/${[b,c][winner]}`))).statusCode,204);
  assert.equal((await handler(event([b,c][loser],'POST',`/invitations/${tokens[loser]}/accept`,{}))).statusCode,200);
});
test('historical memberships remain counted and accessible above the default limit',async()=>{
  const {handler,repository}=setup();
  for(const subject of subjects) await repository.initialize(subject,`${subject[0]}@example.invalid`,[{subject,organizationId:'org-a',role:subject===a ? 'admin' : 'reader'}]);
  const usage=parse(await handler(event(a,'GET','/usage')));assert.equal(usage.members.used,3);assert.equal(usage.members.state,'over');
  assert.equal((await handler({operation:'authorizeMembership',subject:c,organizationId:'org-a'})).role,'reader');
});
