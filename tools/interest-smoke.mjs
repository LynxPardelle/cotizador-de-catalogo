import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {lstat,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {interestDevelopmentResources} from './pilot-interest-development.mjs';
const require=createRequire(new URL('../services/package.json',import.meta.url));
const file=new URL('../artifacts/interest-smoke.json',import.meta.url);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateSyntheticInterest(input,runId,kind){
 assert.match(runId,/^[0-9]{8,17}-[0-9a-f]{6,12}$/);assert.ok(['api','browser'].includes(kind));assert.match(input?.requestId??'',uuid);
 assert.equal(input.organizationName,'Organización ficticia QA convocatoria');assert.equal(input.sector,'Práctica sintética');assert.equal(input.contactEmail,`ct-interest-${kind}-${runId}@example.invalid`);
 assert.equal(input.contactConsent,true);assert.equal(input.privacyVersion,'2026-11-19');return input;
}
export function assertInterestReceipt(value,reference){assert.deepEqual(value,{reference,status:'received'});}
async function save(report){const info=await lstat(file).catch(error=>{if(error.code==='ENOENT')return;throw error;});assert.ok(!info?.isSymbolicLink());await writeFile(file,JSON.stringify(report,null,2)+'\n');}
async function readReport(){assert.ok(!(await lstat(file)).isSymbolicLink());return JSON.parse(await readFile(file,'utf8'));}
export async function main(args=process.argv.slice(2)){
 assert.ok((args.length===1&&['--verify','--cleanup'].includes(args[0]))||(args.length===2&&args[0]==='--verify-browser'&&uuid.test(args[1])));
 const context=await interestDevelopmentResources();const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');const {DynamoDBDocumentClient,GetCommand,DeleteCommand}=require('@aws-sdk/lib-dynamodb');
 const client=DynamoDBDocumentClient.from(new DynamoDBClient({region:context.region}));
 const get=async reference=>(await client.send(new GetCommand({TableName:context.interestTable,Key:{PK:`INTEREST#${reference}`,SK:'RECORD'},ConsistentRead:true}))).Item;
 let report=args[0]==='--verify'?{runId:`${Date.now()}-${randomBytes(3).toString('hex')}`,startedAt:new Date().toISOString(),stackName:context.stackName,table:context.interestTable,classification:'Synthetic public intake acceptance, no real applicants or email deliveries.',checks:[],references:[]}:await readReport();
 assert.equal(report.stackName,context.stackName);assert.equal(report.table,context.interestTable);
 async function check(name,operation){const entry={name,ok:false};report.checks.push(entry);try{await operation();entry.ok=true;await save(report);console.log(`Interest QA passed: ${name}.`);}catch(error){entry.errorType=error?.name??'Error';await save(report);throw error;}}
 async function inspect(reference,kind){const item=await get(reference);assert.ok(item);validateSyntheticInterest(item.record,report.runId,kind);assert.equal(item.reference,reference);assert.equal(item.status,'received');assert.equal(item.record.status,'received');assert.equal(item.record.acceptedAt,item.createdAt);assert.equal(item.record.createdAt,item.createdAt);assert.equal(item.expiresAt,Math.floor(Date.parse(item.createdAt)/1000)+90*86400);assert.equal(item.record.expiresAt,item.expiresAt);return item;}
 async function post(body,expected){await new Promise(resolve=>setTimeout(resolve,650));const result=await fetch(`${context.outputs.PublicUrl}/api/v1/pilot-interest`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(result.status,expected);assert.equal(result.headers.get('cache-control'),'no-store');const value=await result.json();assert.ok(!JSON.stringify(value).includes(body.contactEmail));return value;}
 try{
  if(args[0]==='--cleanup'){
   for(const {reference,kind} of report.references){assert.match(reference,uuid);const existing=await get(reference);if(!existing)continue;validateSyntheticInterest(existing.record,report.runId,kind);await client.send(new DeleteCommand({TableName:context.interestTable,Key:{PK:`INTEREST#${reference}`,SK:'RECORD'},ConditionExpression:'#record.#email = :email AND #hash = :hash',ExpressionAttributeNames:{'#record':'record','#email':'contactEmail','#hash':'requestHash'},ExpressionAttributeValues:{':email':existing.record.contactEmail,':hash':existing.requestHash}}));assert.equal(await get(reference),undefined);}
   report.cleanup={syntheticRequestsDeleted:true,dailyCounterRetained:true,completedAt:new Date().toISOString()};await save(report);console.log('Recorded synthetic interest requests removed; daily intake counter retained.');return;
  }
  if(args[0]==='--verify-browser'){
   await check('browser-receipt-persisted-with-consent-and-ninety-day-expiry',async()=>{await inspect(args[1],'browser');if(!report.references.some(item=>item.reference===args[1]))report.references.push({reference:args[1],kind:'browser'});});
   report.browser={reference:args[1],verified:true,verifiedAt:new Date().toISOString()};await save(report);return;
  }
  report.input={requestId:randomUUID(),organizationName:'Organización ficticia QA convocatoria',contactEmail:`ct-interest-api-${report.runId}@example.invalid`,sector:'Práctica sintética',currentMethod:'spreadsheets',monthlyQuotes:'1-20',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'};
  validateSyntheticInterest(report.input,report.runId,'api');report.references.push({reference:report.input.requestId,kind:'api'});report.browserEmail=`ct-interest-browser-${report.runId}@example.invalid`;await save(report);
  await check('anonymous-public-submission-persists-minimum-data-and-redacted-receipt',async()=>{assertInterestReceipt(await post(report.input,202),report.input.requestId);await inspect(report.input.requestId,'api');});
  await check('identical-retry-preserves-first-record-and-conflicting-content-is-rejected',async()=>{const first=await inspect(report.input.requestId,'api');assertInterestReceipt(await post(report.input,202),report.input.requestId);assert.deepEqual(await inspect(report.input.requestId,'api'),first);await post({...report.input,organizationName:'Solicitud QA con contenido diferente'},409);});
  await check('consent-version-and-unknown-fields-rejected-before-any-write',async()=>{for(const body of [{...report.input,requestId:randomUUID(),contactConsent:false},{...report.input,requestId:randomUUID(),privacyVersion:'old'},{...report.input,requestId:randomUUID(),attachment:'not-allowed'}]){await post(body,400);assert.equal(await get(body.requestId),undefined);}});
  await check('public-cannot-read-applicants-and-commercial-api-keeps-authentication',async()=>{for(const suffix of ['',`/${report.input.requestId}`]){const result=await fetch(`${context.outputs.PublicUrl}/api/v1/pilot-interest${suffix}`);assert.equal(result.status,404);assert.ok(!(await result.text()).includes(report.input.contactEmail));}assert.equal((await fetch(`${context.outputs.PublicUrl}/api/v1/catalogs`)).status,401);});
  report.ok=true;report.completedAt=new Date().toISOString();await save(report);console.log('Interest AWS acceptance passed; browser email prepared in synthetic report, no messages sent.');
 }finally{client.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(`Interest QA failed (${error?.name??'Error'}); no applicant data printed.`);process.exitCode=1;});
