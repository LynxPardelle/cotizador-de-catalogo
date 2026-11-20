import test from 'node:test';
import assert from 'node:assert/strict';
import { createCognitoUsers } from './cognito.mjs';
test('recipient binding reads verified email and legacy groups from the configured Cognito pool',async()=>{
  const subject='11111111-1111-4111-8111-111111111111';const commands=[];
  const results=[{Enabled:true,UserStatus:'CONFIRMED',UserAttributes:[{Name:'sub',Value:subject},{Name:'email',Value:'confirmed@example.invalid'},{Name:'email_verified',Value:'true'}]},{Groups:[{GroupName:'org:server-group:admin'}],NextToken:'next'},{Groups:[{GroupName:'org:another:reader'}]}];
  const users=createCognitoUsers({client:{async send(command){commands.push(command);return results.shift();}},userPoolId:'us-east-1_Test'});
  assert.deepEqual(await users.get(subject),{subject,email:'confirmed@example.invalid',emailVerified:true,confirmed:true});
  assert.deepEqual(await users.groups(subject),['org:server-group:admin','org:another:reader']);
  assert.ok(commands.every(command=>command.input.UserPoolId==='us-east-1_Test' && command.input.Username===subject));
  assert.equal(commands[2].input.NextToken,'next');
});
