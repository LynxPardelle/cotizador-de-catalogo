import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {lstat,mkdir,open} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {developmentResources} from './plan-development.mjs';
import {validUuid} from '../services/shared/http.mjs';

const require=createRequire(new URL('../services/package.json',import.meta.url));
const root=fileURLToPath(new URL('..',import.meta.url));
const region='us-east-1',stackName='cotitrama-development';
const execute=promisify(execFile);
const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient,ScanCommand,GetCommand}=require('@aws-sdk/lib-dynamodb');
const epoch=now=>{assert.ok(now instanceof Date&&Number.isFinite(now.getTime()),'Invalid observation time.');return Math.floor(now.getTime()/1000);};

export function validateInterestTable(context,table) {
  assert.equal(context?.stackName,stackName,'Only the CotiTrama development stack is allowed.');
  assert.equal(context?.region,region,'Only the development region is allowed.');
  assert.equal(context?.outputs?.PublicUrl,'https://cotitrama-dev.lynxpardelle.com','Only the development product is allowed.');
  assert.ok(typeof table==='string'&&table.startsWith(`${stackName}-InterestTable-`),'The interest table must belong to this development stack.');
  return table;
}

export async function interestDevelopmentResources() {
  // The shared guard also checks the exact AWS account and UPDATE_COMPLETE.
  const context=await developmentResources();
  const {stdout}=await execute(process.platform==='win32'?'aws.exe':'aws',['cloudformation','list-stack-resources','--stack-name',stackName,'--region',region,'--output','json','--no-cli-pager'],{windowsHide:true,maxBuffer:4*1024*1024});
  const resources=JSON.parse(stdout).StackResourceSummaries;
  assert.ok(Array.isArray(resources),'Development stack resources are unavailable.');
  const matches=resources.filter(resource=>resource.LogicalResourceId==='InterestTable'&&resource.ResourceType==='AWS::DynamoDB::Table');
  assert.equal(matches.length,1,'Exactly one owned interest table is required.');
  return {...context,interestTable:validateInterestTable(context,matches[0].PhysicalResourceId)};
}

export function summarizeInterest(item,now=new Date()) {
  const current=epoch(now);
  if(!item||item.SK!=='RECORD'||!validUuid(item.reference)||item.PK!==`INTEREST#${item.reference}`||item.status!=='received'||!Number.isSafeInteger(item.expiresAt)||item.expiresAt<=current) return undefined;
  if(typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))||new Date(item.createdAt).toISOString()!==item.createdAt) return undefined;
  return {reference:item.reference,status:item.status,createdAt:item.createdAt,expiresAt:item.expiresAt};
}

export async function listInterestSummaries({client,table,now=new Date()}) {
  validateInterestTable({stackName,region,outputs:{PublicUrl:'https://cotitrama-dev.lynxpardelle.com'}},table);
  epoch(now);const summaries=new Map();let pages=0,scannedRows=0,omittedItems=0,ExclusiveStartKey;
  do {
    const Limit=500-scannedRows;
    const page=await client.send(new ScanCommand({TableName:table,ProjectionExpression:'#pk, #sk, #reference, #status, #createdAt, #expiresAt',ExpressionAttributeNames:{'#pk':'PK','#sk':'SK','#reference':'reference','#status':'status','#createdAt':'createdAt','#expiresAt':'expiresAt'},ConsistentRead:true,Limit,ExclusiveStartKey}));
    const scanned=page.ScannedCount ?? page.Items?.length ?? 0;
    assert.ok(Number.isSafeInteger(scanned)&&scanned>=0&&scanned<=Limit,'The metadata scan exceeded its read budget.');
    scannedRows+=scanned;pages++;
    for(const item of page.Items ?? []) {const summary=summarizeInterest(item,now);if(summary)summaries.set(summary.reference,summary);else omittedItems++;}
    ExclusiveStartKey=page.LastEvaluatedKey;
  } while(ExclusiveStartKey&&pages<10&&scannedRows<500);
  return {summaries:[...summaries.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.reference.localeCompare(b.reference)),partial:!!ExclusiveStartKey,pages,scannedRows,omittedItems};
}

async function existing(path) {return lstat(path).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});}
export async function writePrivateExport(item,reference,{projectRoot=root,now=new Date()}={}) {
  assert.ok(validUuid(reference),'A valid request reference is required.');
  const summary=summarizeInterest(item,now);
  assert.ok(summary&&summary.reference===reference&&item.record&&typeof item.record==='object'&&!Array.isArray(item.record)&&item.record.requestId===reference,'Only an unexpired recorded request can be exported.');
  const resolvedRoot=resolve(projectRoot),directory=join(resolvedRoot,'artifacts');
  const rootInfo=await lstat(resolvedRoot);assert.ok(rootInfo.isDirectory()&&!rootInfo.isSymbolicLink(),'The project directory cannot be a symbolic link.');
  await mkdir(directory,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});
  const directoryInfo=await lstat(directory);assert.ok(directoryInfo.isDirectory()&&!directoryInfo.isSymbolicLink(),'The artifacts directory cannot be a symbolic link.');
  const target=join(directory,`pilot-interest-${reference}-private.json`);
  assert.equal(dirname(target),directory,'The private export must remain inside project artifacts.');
  const prior=await existing(target);assert.ok(!prior,'The private export already exists; it will not be replaced.');
  const file=await open(target,'wx',0o600);
  try {await file.writeFile(JSON.stringify(item,null,2)+'\n','utf8');} finally {await file.close();}
  // Windows permission bits are advisory; this is a private local file, not encryption.
  return target;
}

export async function main(args=process.argv.slice(2)) {
  assert.ok((args.length===1&&args[0]==='--list')||(args.length===2&&args[0]==='--export'&&validUuid(args[1])),'Use --list or --export request-uuid.');
  const context=await interestDevelopmentResources();
  const client=DynamoDBDocumentClient.from(new DynamoDBClient({region}));
  try {
    if(args[0]==='--list') {const result=await listInterestSummaries({client,table:context.interestTable});console.log(JSON.stringify(result,null,2));return result;}
    const reference=args[1];
    const {Item}=await client.send(new GetCommand({TableName:context.interestTable,Key:{PK:`INTEREST#${reference}`,SK:'RECORD'},ConsistentRead:true}));
    const path=await writePrivateExport(Item,reference);console.log(path);return {path};
  } finally {client.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(`CotiTrama pilot interest operation failed (${error?.name ?? 'Error'}); no contact data was printed.`);process.exitCode=1;});
