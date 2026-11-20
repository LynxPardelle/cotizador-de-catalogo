import test from 'node:test';import assert from 'node:assert/strict';
const module=await import('./auth.mjs').catch(()=>({}));
const subject='11111111-1111-4111-8111-111111111111';
const event=()=>({requestContext:{authorizer:{jwt:{claims:{sub:subject,token_use:'access','cognito:groups':['cotitrama-pilot-reviewers','org:demo:admin']}}}}});
function fake({enabled=true,status='CONFIRMED',verified='true',groups=[],pages}={}){const calls=[];return {calls,async send(command){calls.push(command);if(command.constructor.name==='AdminGetUserCommand')return {Enabled:enabled,UserStatus:status,UserAttributes:[{Name:'sub',Value:subject},{Name:'email',Value:'private@example.invalid'},{Name:'email_verified',Value:verified}]};return pages?pages(calls):{Groups:groups.map(GroupName=>({GroupName}))};}};}
function authorize(client){assert.equal(typeof module.createReviewerAuthorizer,'function');return module.createReviewerAuthorizer({client,userPoolId:'own-pool'});}
test('current dedicated group is required even when JWT claims org admin or reviewer',async()=>{
 const client=fake();await assert.rejects(authorize(client)(event()),{statusCode:403});assert.ok(client.calls.some(x=>x.constructor.name==='AdminListGroupsForUserCommand'));assert.ok(client.calls.every(x=>x.input.UserPoolId==='own-pool'&&x.input.Username===subject));
});
test('enabled verified current reviewer is allowed without exposing email and a later revocation is immediately effective',async()=>{
 const client=fake({groups:['cotitrama-pilot-reviewers']});assert.deepEqual(await authorize(client)(event()),{subject});const denied=fake({groups:[]});await assert.rejects(authorize(denied)(event()),{statusCode:403});
 for(const config of [{enabled:false,groups:['cotitrama-pilot-reviewers']},{verified:'false',groups:['cotitrama-pilot-reviewers']}])await assert.rejects(authorize(fake(config))(event()),{statusCode:403});
});
test('missing access identity never reads Cognito and group pagination is bounded',async()=>{
 const client=fake();await assert.rejects(authorize(client)({}),{statusCode:401});assert.equal(client.calls.length,0);
 const pages=fake({pages:()=>({Groups:[],NextToken:'more'})});await assert.rejects(authorize(pages)(event()),{statusCode:503});assert.equal(pages.calls.filter(x=>x.constructor.name==='AdminListGroupsForUserCommand').length,10);
});

test('a dedicated reviewer with an unconfirmed or reset-required account cannot read applications',async()=>{
 for(const status of ['UNCONFIRMED','RESET_REQUIRED','FORCE_CHANGE_PASSWORD',undefined]){
  const client=fake({status:status??null,groups:['cotitrama-pilot-reviewers']});
  await assert.rejects(authorize(client)(event()),{statusCode:403});
  assert.equal(client.calls.length,1);
 }
});
