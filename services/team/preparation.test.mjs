import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamHandler} from './index.mjs';
import {createMemoryTeamRepository} from './memory.mjs';
import {createDynamoTeamRepository} from './dynamo.mjs';
import {createCognitoUsers} from './cognito.mjs';
import {HttpError} from '../shared/errors.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
async function setup(){
 const repository=createMemoryTeamRepository(),accounts=new Map([a,b,c].map(subject=>[subject,{subject,confirmed:true,emailVerified:true}]));
 for(const [subject,role]of [[a,'admin'],[b,'seller'],[c,'reader']])await repository.initialize(subject,`${subject}@example.invalid`,[{subject,organizationId:'org-a',role,joinedAt:'2026-11-20T00:00:00Z'}]);
 await repository.initialize('44444444-4444-4444-8444-444444444444','other@example.invalid',[{organizationId:'org-other',role:'admin'}]);
 const users={get:async subject=>accounts.get(subject),groups:()=>assert.fail('pilot reads never initialize legacy profiles')};
 repository.profile=()=>assert.fail('pilot queries cannot initialize or migrate profiles');
 return {repository,accounts,handler:createTeamHandler({repository,users})};
}
test('IAM pilot workspace lookup returns only current admin ids and labels without commercial initialization',async()=>{
 const {handler,repository}=await setup();const result=await handler({operation:'pilotAdminWorkspaces',subject:a});assert.deepEqual(result,[{workspaceId:'org-a',label:'Espacio org-a'}]);assert.ok(!JSON.stringify(result).includes('@'));
 await repository.changeRole('org-a',a,b,'admin');await repository.changeRole('org-a',a,a,'reader');assert.deepEqual(await handler({operation:'pilotAdminWorkspaces',subject:a}),[]);
 const http=await handler({operation:'pilotAdminWorkspaces',subject:a,requestContext:{http:{method:'POST'}},rawPath:'/api/v1/team/pilot'});assert.equal(http.statusCode,401);
});
test('pilot readiness requires the linked administrator and a distinct confirmed verified seller',async()=>{
 const {handler,accounts,repository}=await setup(),event={operation:'pilotReadiness',subject:a,organizationId:'org-a'};
 assert.deepEqual(await handler(event),{adminReady:true,sellerReady:true,verifiedMembers:3});
 accounts.set(b,{subject:b,confirmed:false,emailVerified:true});assert.deepEqual(await handler(event),{adminReady:true,sellerReady:false,verifiedMembers:2});
 accounts.set(b,{subject:b,confirmed:true,emailVerified:false});assert.equal((await handler(event)).sellerReady,false);
 accounts.set(b,{subject:b,confirmed:true,emailVerified:true});await repository.changeRole('org-a',a,b,'admin');assert.deepEqual(await handler(event),{adminReady:true,sellerReady:false,verifiedMembers:3});
 accounts.set(a,{subject:a,confirmed:false,emailVerified:true});assert.equal((await handler(event)).error.statusCode,403);
 assert.equal((await handler({...event,subject:c})).error.statusCode,403);
});
test('a disabled account is excluded while an unavailable identity dependency cannot claim readiness',async()=>{
 const {repository}=await setup();let unavailable=false;const handler=createTeamHandler({repository,users:{get:async subject=>{if(subject===b)throw new HttpError(unavailable?503:403,'IDENTITY_ERROR','unavailable');return {subject,confirmed:true,emailVerified:true};}}});
 assert.deepEqual(await handler({operation:'pilotReadiness',subject:a,organizationId:'org-a'}),{adminReady:true,sellerReady:false,verifiedMembers:2});unavailable=true;
 assert.equal((await handler({operation:'pilotReadiness',subject:a,organizationId:'org-a'})).error.statusCode,503);
});
test('pilot member queries stop at Empresa capacity and bound DynamoDB pagination',async()=>{
 const calls=[];let excess=false,paged=false;const repository=createDynamoTeamRepository({table:'own-members',client:{async send(command){calls.push(command);return {Items:Array.from({length:excess?26:1},(_,index)=>({member:{subject:index===0?a:b,role:'admin',organizationId:'org-a'}})),...(paged?{LastEvaluatedKey:{PK:'ORG#org-a',SK:'MEMBER#more'}}:{})};}}});
 assert.equal(typeof repository.pilotMembers,'function');assert.equal((await repository.pilotMembers('org-a')).length,1);assert.equal(calls[0].input.ConsistentRead,true);assert.equal(calls[0].input.Limit,26);
 excess=true;await assert.rejects(repository.pilotMembers('org-a'),{statusCode:503});excess=false;paged=true;const before=calls.length;await assert.rejects(repository.pilotMembers('org-a'),{statusCode:503});assert.equal(calls.length-before,4);
});
test('Cognito adapter exposes confirmed status from the live account without changing other access semantics',async()=>{
 const users=createCognitoUsers({userPoolId:'own-pool',client:{async send(){return {Enabled:true,UserStatus:'UNCONFIRMED',UserAttributes:[{Name:'sub',Value:a},{Name:'email',Value:'person@example.invalid'},{Name:'email_verified',Value:'true'}]};}}});
 const user=await (users.pilotGet??users.get)(a);assert.equal(user.confirmed,false);assert.equal(user.emailVerified,true);
});
