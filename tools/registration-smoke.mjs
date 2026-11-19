import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../services/package.json', import.meta.url));
const sdk = require('@aws-sdk/client-cognito-identity-provider');
const region = 'us-east-1';
const stackName = 'cotitrama-development';
const privateFile = new URL('../artifacts/registration-qa-private.json', import.meta.url);
const codeFile = new URL('../artifacts/registration-code-private.json', import.meta.url);
const reportFile = new URL('../artifacts/registration-verified.json', import.meta.url);
const json = async (url) => JSON.parse(await readFile(url, 'utf8'));
const save = (url, value) => writeFile(url, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });

async function main() {
  const mode = process.argv[2];
  assert.ok(['--start', '--confirm', '--cleanup'].includes(mode), 'Use --start email, --confirm, or --cleanup.');
  const { stdout } = await promisify(execFile)(process.platform === 'win32' ? 'aws.exe' : 'aws',
    ['cloudformation', 'describe-stacks', '--stack-name', stackName, '--region', region, '--output', 'json', '--no-cli-pager']);
  const stack = JSON.parse(stdout).Stacks[0];
  assert.ok(stack.StackId.startsWith(`arn:aws:cloudformation:${region}:765932874577:stack/${stackName}/`));
  const outputs = Object.fromEntries(stack.Outputs.map((item) => [item.OutputKey, item.OutputValue]));
  assert.equal(outputs.PublicUrl, 'https://cotitrama-dev.lynxpardelle.com');
  const client = new sdk.CognitoIdentityProviderClient({ region });
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  try {
    if (mode === '--start') {
      assert.equal(await readFile(privateFile, 'utf8').then(() => true).catch(() => false), false, 'An existing registration test must be completed first.');
      const email = process.argv[3];
      assert.match(email ?? '', /^[a-zA-Z0-9._-]+\+cotitrama-qa-[a-z0-9-]+@gmail\.com$/);
      const state = { email, password: `Ct1!${randomBytes(24).toString('base64url')}`, userPoolId: outputs.UserPoolId, clientId: outputs.UserPoolClientId, startedAt: new Date().toISOString() };
      await save(privateFile, state);
      const result = await client.send(new sdk.SignUpCommand({ ClientId: state.clientId, Username: email, Password: state.password, UserAttributes: [{ Name: 'email', Value: email }] }));
      state.sub = result.UserSub;
      await save(privateFile, state);
      assert.equal(result.UserConfirmed, false, 'Public signup must require confirmation.');
      const user = await client.send(new sdk.AdminGetUserCommand({ UserPoolId: state.userPoolId, Username: email }));
      assert.equal(user.UserStatus, 'UNCONFIRMED');
      await save(reportFile, { startedAt: state.startedAt, confirmationRequired: true, statusBefore: user.UserStatus, deliveryMedium: result.CodeDeliveryDetails?.DeliveryMedium, emailReceived: false, confirmed: false });
      console.log('Registration started in development; confirmation is required. No password or code was printed.');
      return;
    }
    const state = await json(privateFile);
    assert.equal(state.userPoolId, outputs.UserPoolId);
    assert.match(state.email ?? '', /^[a-zA-Z0-9._-]+\+cotitrama-qa-[a-z0-9-]+@gmail\.com$/);
    const user = await client.send(new sdk.AdminGetUserCommand({ UserPoolId: state.userPoolId, Username: state.email }));
    const attrs = Object.fromEntries(user.UserAttributes.map((item) => [item.Name, item.Value]));
    assert.equal(attrs.sub, state.sub);
    assert.equal(attrs.email, state.email);
    if (mode === '--confirm') {
      const { code } = await json(codeFile);
      assert.match(code, /^\d{6}$/);
      await client.send(new sdk.ConfirmSignUpCommand({ ClientId: state.clientId, Username: state.email, ConfirmationCode: code }));
      const confirmed = await client.send(new sdk.AdminGetUserCommand({ UserPoolId: state.userPoolId, Username: state.email }));
      const attributes = Object.fromEntries(confirmed.UserAttributes.map((item) => [item.Name, item.Value]));
      assert.equal(confirmed.UserStatus, 'CONFIRMED');
      assert.equal(attributes.email_verified, 'true');
      const groups = await client.send(new sdk.AdminListGroupsForUserCommand({ UserPoolId: state.userPoolId, Username: state.email }));
      assert.equal(groups.Groups.length, 1);
      state.username = confirmed.Username;
      state.group = groups.Groups[0].GroupName;
      state.organizationId = state.group.split(':')[1];
      await save(privateFile, state);
      const { stdout: resourceJson } = await promisify(execFile)(process.platform === 'win32' ? 'aws.exe' : 'aws',
        ['cloudformation', 'describe-stack-resource', '--stack-name', stackName, '--logical-resource-id', 'MembersTable', '--region', region, '--output', 'json', '--no-cli-pager']);
      const table = JSON.parse(resourceJson).StackResourceDetail.PhysicalResourceId;
      assert.ok(table.startsWith(`${stackName}-MembersTable-`));
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
      const database = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
      try {
        const result = await database.send(new GetCommand({ TableName: table, Key: { PK: `USER#${state.sub}`, SK: `ORG#${state.organizationId}` }, ConsistentRead: true }));
        assert.equal(result.Item?.member?.role, 'admin', 'PostConfirmation must create the owner in the identity database.');
        assert.equal(result.Item.member.email, state.email);
      } finally { database.destroy(); }
      await save(reportFile, { ...(await json(reportFile)), emailReceived: true, confirmed: true, statusAfter: confirmed.UserStatus, emailVerified: true, organizationAssigned: true, ownerMembershipPersisted: true, confirmedAt: new Date().toISOString(), method: 'Real SignUp, Gmail receipt, real confirmation code and Cognito PostConfirmation plus a strongly consistent DynamoDB membership read.' });
      await unlink(codeFile);
      console.log('Real email confirmation passed; verified account and organization assigned.');
    } else {
      await client.send(new sdk.AdminDeleteUserCommand({ UserPoolId: state.userPoolId, Username: state.email }));
      if (state.group) {
        const members = await client.send(new sdk.ListUsersInGroupCommand({ UserPoolId: state.userPoolId, GroupName: state.group }));
        if (!members.Users.length && !members.NextToken) await client.send(new sdk.DeleteGroupCommand({ UserPoolId: state.userPoolId, GroupName: state.group }));
      }
      await save(reportFile, { ...(await json(reportFile)), qaAccountDeleted: true });
      await unlink(privateFile);
      console.log('The recorded registration QA account was deleted.');
    }
  } finally { client.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(`Registration QA failed (${error.name}, ${error.code ?? 'no-code'}).`); process.exitCode = 1; });
}
