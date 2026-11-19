import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { planFor } from '../services/shared/quota.mjs';
import { validId } from '../services/shared/http.mjs';
import { validateDevelopmentStack } from './aws-smoke.mjs';

const require = createRequire(new URL('../services/package.json', import.meta.url));
const region = 'us-east-1';
const stackName = 'cotitrama-development';
const execute = promisify(execFile);
async function aws(args) {
  const { stdout } = await execute(process.platform === 'win32' ? 'aws.exe' : 'aws', [...args, '--region', region, '--output', 'json', '--no-cli-pager'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout);
}
export function validatePlanTarget({ organizationId, planId, metadata }) {
  assert.ok(validId(organizationId), 'Invalid organization identifier.');
  const plan = planFor(planId);
  assert.ok(metadata && metadata.PK === `ORG#${organizationId}` && metadata.SK === 'META', 'The organization metadata must already exist.');
  assert.ok(Number.isSafeInteger(metadata.adminCount) && metadata.adminCount >= 1, 'The organization needs an existing administrator.');
  return plan;
}
export async function developmentResources() {
  const config = JSON.parse(await readFile(new URL('../infra/environments.json', import.meta.url), 'utf8'));
  const stack = (await aws(['cloudformation', 'describe-stacks', '--stack-name', stackName])).Stacks[0];
  assert.ok(stack.StackId.startsWith(`arn:aws:cloudformation:${region}:765932874577:stack/${stackName}/`), 'Only the CotiTrama development account is allowed.');
  assert.equal(stack.StackStatus, 'UPDATE_COMPLETE', 'Development must be fully deployed before an operational change.');
  const outputs = validateDevelopmentStack(config, stack);
  const resources = (await aws(['cloudformation', 'list-stack-resources', '--stack-name', stackName])).StackResourceSummaries;
  const tables = {};
  for (const key of ['MembersTable', 'CatalogTable', 'QuotesTable']) {
    const value = resources.find(resource => resource.LogicalResourceId === key && resource.ResourceType === 'AWS::DynamoDB::Table')?.PhysicalResourceId;
    assert.ok(value?.startsWith(`${stackName}-${key}-`), 'The table must belong to this development stack.');
    tables[key] = value;
  }
  return { outputs, tables, region, stackName };
}
export async function assignDevelopmentPlan(context, organizationId, planId) {
  assert.equal(context.stackName, stackName); assert.equal(context.region, region);
  assert.ok(context.tables.MembersTable.startsWith(`${stackName}-MembersTable-`));
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  try {
    const Key = { PK: `ORG#${organizationId}`, SK: 'META' };
    const metadata = (await client.send(new GetCommand({ TableName: context.tables.MembersTable, Key, ConsistentRead: true }))).Item;
    const plan = validatePlanTarget({ organizationId, planId, metadata });
    const updatedAt = new Date().toISOString();
    const oldPlan = metadata.planId;
    await client.send(new UpdateCommand({
      TableName: context.tables.MembersTable, Key,
      UpdateExpression: 'SET #plan = :plan, planUpdatedAt = :at ADD planRevision :one',
      ConditionExpression: `attribute_exists(PK) AND adminCount >= :one AND ${oldPlan === undefined ? 'attribute_not_exists(#plan)' : '#plan = :previous'}`,
      ExpressionAttributeNames: { '#plan': 'planId' },
      ExpressionAttributeValues: { ':plan': plan.id, ':at': updatedAt, ':one': 1, ...(oldPlan === undefined ? {} : { ':previous': oldPlan }) },
    }));
    return { organizationId, plan, applied: true, billingEnabled: false, updatedAt };
  } finally { client.destroy(); }
}
async function main(args = process.argv.slice(2)) {
  assert.ok((args[0] === '--show' && args.length === 2) || (args[0] === '--set' && args.length === 3), 'Use --show organizationId or --set organizationId esencial|equipo|empresa.');
  const context = await developmentResources();
  if (args[0] === '--set') { console.log(JSON.stringify(await assignDevelopmentPlan(context, args[1], args[2]), null, 2)); return; }
  assert.ok(validId(args[1]));
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  try {
    const metadata = (await client.send(new GetCommand({ TableName: context.tables.MembersTable, Key: { PK: `ORG#${args[1]}`, SK: 'META' }, ConsistentRead: true }))).Item;
    console.log(JSON.stringify({ organizationId: args[1], plan: validatePlanTarget({ organizationId: args[1], planId: metadata?.planId, metadata }), billingEnabled: false }, null, 2));
  } finally { client.destroy(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(`CotiTrama development plan operation failed (${error.name}).`); process.exitCode = 1; });
