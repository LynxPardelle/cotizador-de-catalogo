import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamAuthorizer } from './team-client.mjs';
const subject='11111111-1111-4111-8111-111111111111';
const event={headers:{'X-Organization-Id':'org-a'},requestContext:{authorizer:{jwt:{claims:{sub:subject,token_use:'access','cognito:groups':['org:forged:admin']}}}}};
test('production authorizer sends only subject and selected workspace and uses returned database role',async()=>{
  const commands=[];const client={async send(command){commands.push(command);return {Payload:Buffer.from(JSON.stringify({subject,organizationId:'org-a',role:'reader'}))};}};
  const authorize=createTeamAuthorizer({client,functionName:'team-function'});
  const user=await authorize(event);assert.equal(user.role,'reader');
  assert.deepEqual(JSON.parse(commands[0].input.Payload.toString()),{operation:'authorizeMembership',subject,organizationId:'org-a'});
  assert.ok(!commands[0].input.Payload.toString().includes('forged'));
  await authorize(event);assert.equal(commands.length,2,'Membership authorization cannot be cached between business requests.');
});
test('membership denial is preserved while failed or malformed service results fail closed',async()=>{
  for(const [response,status] of [[{error:{statusCode:403,code:'MEMBERSHIP_REQUIRED',message:'No access'}},403],[{subject,organizationId:'other',role:'admin'},503],[{subject,organizationId:'org-a',role:'unknown'},503]]) {
    const authorize=createTeamAuthorizer({client:{async send(){return {Payload:Buffer.from(JSON.stringify(response))};}},functionName:'team-function'});
    await assert.rejects(authorize(event),{statusCode:status});
  }
  const authorize=createTeamAuthorizer({client:{async send(){return {FunctionError:'Unhandled'};}},functionName:'team-function'});
  await assert.rejects(authorize(event),{code:'TEAM_UNAVAILABLE'});
  assert.throws(()=>createTeamAuthorizer({functionName:''}),/Missing Team/);
});
