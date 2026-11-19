import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createMemoryTeamRepository } from '../team/memory.mjs';

const module=await import('./index.mjs').catch(()=>({}));
const confirmed=(sub='11111111-1111-4111-8111-111111111111',userName='person-one')=>({
  version:'1',triggerSource:'PostConfirmation_ConfirmSignUp',region:'us-east-1',
  userPoolId:'us-east-1_AbCdEf123',userName,
  request:{userAttributes:{sub,email_verified:'true',email:'private@example.invalid'},clientMetadata:{organizationId:'victim',role:'admin'}},response:{},
});
function client() {
  const groups=new Set(); const memberships=new Map(); const commands=[];
  return {groups,memberships,commands,async send(command){
    commands.push(command);
    if(command.constructor.name==='CreateGroupCommand') {
      if(groups.has(command.input.GroupName)) throw Object.assign(new Error('group exists'),{name:'GroupExistsException'});
      groups.add(command.input.GroupName);return {};
    }
    if(command.constructor.name==='AdminAddUserToGroupCommand') {
      const existing=memberships.get(command.input.Username) ?? new Set();
      existing.add(command.input.GroupName);memberships.set(command.input.Username,existing);return {};
    }
    throw new Error('Unexpected Cognito operation');
  }};
}

test('confirmed verified signup gets only its deterministic isolated admin group',async()=>{
  assert.equal(typeof module.createOnboardingHandler,'function');
  const api=client(); const handler=module.createOnboardingHandler({client:api}); const event=confirmed();
  const original=structuredClone(event);
  assert.equal(await handler(event),event);
  assert.deepEqual(event,original,'onboarding must not change verified attributes or confirmation response');
  assert.equal(api.commands.length,2);
  const org=`org-${createHash('sha256').update(`${event.userPoolId}:${event.request.userAttributes.sub}`).digest('hex').slice(0,32)}`;
  const group=`org:${org}:admin`;
  assert.equal(api.commands[0].constructor.name,'CreateGroupCommand');
  assert.deepEqual(api.commands[0].input,{UserPoolId:event.userPoolId,GroupName:group});
  assert.equal(api.commands[1].constructor.name,'AdminAddUserToGroupCommand');
  assert.deepEqual(api.commands[1].input,{UserPoolId:event.userPoolId,Username:event.userName,GroupName:group});
  assert.ok(!JSON.stringify(api.commands.map(command=>command.input)).includes('victim'));
  assert.ok(!JSON.stringify(api.commands.map(command=>command.input)).includes('private@example.invalid'));
});

test('two users get distinct organizations and retries cannot create additional groups',async()=>{
  assert.equal(typeof module.createOnboardingHandler,'function');
  const api=client();const handler=module.createOnboardingHandler({client:api});
  const one=confirmed();const two=confirmed('22222222-2222-4222-8222-222222222222','person-two');
  await handler(one);await handler(two);await handler(one);await handler(two);
  assert.equal(api.groups.size,2);
  assert.equal(api.memberships.get(one.userName).size,1);
  assert.equal(api.memberships.get(two.userName).size,1);
  assert.notDeepEqual([...api.memberships.get(one.userName)],[...api.memberships.get(two.userName)]);
});

test('password reset confirmation never provisions another organization',async()=>{
  assert.equal(typeof module.createOnboardingHandler,'function');
  const api=client();const handler=module.createOnboardingHandler({client:api});
  const event={...confirmed(),triggerSource:'PostConfirmation_ConfirmForgotPassword'};
  assert.equal(await handler(event),event);
  assert.equal(api.commands.length,0);
});

test('invalid signup events and unverified email cannot assign membership',async()=>{
  assert.equal(typeof module.createOnboardingHandler,'function');
  const invalid=[null,{}, {...confirmed(),triggerSource:'PreSignUp_SignUp'}, {...confirmed(),userPoolId:'../different-pool'}, {...confirmed(),userName:''}, {...confirmed(),userName:'name with spaces'}];
  for(const email_verified of ['false',undefined,true]) {const event=confirmed();event.request.userAttributes.email_verified=email_verified;invalid.push(event);}
  for(const sub of ['', 'other-user', undefined]) {const event=confirmed();event.request.userAttributes.sub=sub;invalid.push(event);}
  for(const event of invalid) {
    const api=client();await assert.rejects(module.createOnboardingHandler({client:api})(event),{message:'Invalid verified signup event.'});
    assert.equal(api.commands.length,0);
  }
});

test('group-creation failures stop assignment and never expose personal data',async()=>{
  assert.equal(typeof module.createOnboardingHandler,'function');
  const calls=[];
  const api={async send(command){calls.push(command);throw Object.assign(new Error('service error for private@example.invalid'),{name:'NotAuthorizedException'});}};
  await assert.rejects(module.createOnboardingHandler({client:api})(confirmed()),{message:'Unable to provision organization membership.'});
  assert.equal(calls.length,1);
});

test('a retry after partial provisioning reuses the existing group',async()=>{
  assert.equal(typeof module.createOnboardingHandler,'function');
  const api=client();const send=api.send.bind(api);let failAdd=true;
  api.send=async command=>{if(command.constructor.name==='AdminAddUserToGroupCommand' && failAdd){failAdd=false;throw new Error('temporary failure');}return send(command);};
  const handler=module.createOnboardingHandler({client:api});const event=confirmed();
  await assert.rejects(handler(event),{message:'Unable to provision organization membership.'});
  await handler(event);
  assert.equal(api.groups.size,1);assert.equal(api.memberships.get(event.userName).size,1);
});

test('onboarding initializes authoritative owner membership once and does not restore a later demoted role',async()=>{
  const repository=createMemoryTeamRepository();const api=client();const event=confirmed();
  const handler=module.createOnboardingHandler({client:api,memberships:repository,clock:()=>new Date('2026-11-20T12:00:00Z')});
  await handler(event);
  const members=await repository.memberships(event.request.userAttributes.sub);
  assert.equal(members.length,1);assert.equal(members[0].role,'admin');assert.equal(members[0].email,'private@example.invalid');
  const other='22222222-2222-4222-8222-222222222222';
  await repository.initialize(other,'other@example.invalid',[{subject:other,organizationId:members[0].organizationId,role:'admin',joinedAt:'2026-11-20T12:00:00Z'}]);
  await repository.changeRole(members[0].organizationId,other,event.request.userAttributes.sub,'reader');
  await handler(event);
  assert.equal((await repository.memberships(event.request.userAttributes.sub))[0].role,'reader');
});
