import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {lstat,mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {interestDevelopmentResources} from './pilot-interest-development.mjs';
import {validateApplicationsContext} from './applications-smoke.mjs';
import {main as quotaMain,validateQuotaManifest} from './quota-smoke.mjs';
import {reviewerAccess} from './pilot-reviewer-development.mjs';
import {interestRequest} from '../services/interest/domain.mjs';
import {hash,validUuid} from '../services/shared/http.mjs';
import {ownOrganization} from '../services/team/domain.mjs';
import {syntheticCatalog} from '../services/fixtures/catalog.mjs';

const require=createRequire(new URL('../services/package.json',import.meta.url));
const directory=fileURLToPath(new URL('../artifacts/',import.meta.url));
const privateFile=join(directory,'preparation-qa-private.json'),quotaFile=join(directory,'quota-qa-private.json'),reportFile=join(directory,'preparation-smoke.json');
const labels=['owner','a','b'],runPattern=/^[0-9]{8,17}-[a-f0-9]{6,12}$/,origin='https://cotitrama-dev.lynxpardelle.com';
const canonicalUuid=value=>validUuid(value)&&value===value.toLowerCase();
const existing=path=>readFile(path,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});
export function preparationFixture(runId,reference){
 assert.match(runId??'',runPattern);assert.ok(canonicalUuid(reference));
 return interestRequest({requestId:reference,organizationName:`Preparación ficticia CotiTrama QA ${runId}`,contactEmail:`ct-quota-a-${runId}@example.invalid`,sector:'Prueba sintética',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'});
}
export function validatePreparationManifest(manifest,context,quota){
 validateApplicationsContext(context);assert.equal(manifest?.version,1);assert.match(manifest.runId??'',runPattern);
 for(const name of ['region','stackName','interestTable'])assert.equal(manifest[name],context[name]);assert.equal(manifest.userPoolId,context.outputs.UserPoolId);
 assert.deepEqual(Object.keys(manifest.actors??{}).sort(),[...labels].sort());
 for(const label of labels){const actor=manifest.actors[label];assert.equal(actor.email,`ct-quota-${label}-${manifest.runId}@example.invalid`);assert.ok(canonicalUuid(actor.sub));assert.ok(actor.username===actor.email||canonicalUuid(actor.username));assert.equal(actor.organizationId,ownOrganization(manifest.userPoolId,actor.sub));}
 assert.deepEqual(manifest.application?.body,preparationFixture(manifest.runId,manifest.application?.reference));assert.equal(manifest.catalogId,`prep-${manifest.runId}`);
 if(quota){validateQuotaManifest(quota,context);assert.equal(quota.runId,manifest.runId);for(const label of labels)for(const field of ['email','username','sub','organizationId'])assert.equal(manifest.actors[label][field],quota.actors[label][field]);}
 return manifest;
}
export function validatePreparationRoot(item,manifest){
 const {reference,body}=manifest.application;assert.deepEqual(body,preparationFixture(manifest.runId,reference));assert.ok(item);assert.equal(item.PK,`INTEREST#${reference}`);assert.equal(item.SK,'RECORD');assert.equal(item.reference,reference);assert.equal(item.status,'received');assert.equal(item.requestHash,hash(body));
 assert.equal(new Date(item.createdAt).toISOString(),item.createdAt);assert.equal(item.expiresAt,Math.floor(Date.parse(item.createdAt)/1000)+90*86400);
 assert.deepEqual(item.record,{...body,status:'received',createdAt:item.createdAt,acceptedAt:item.createdAt,expiresAt:item.expiresAt});
 const original=Object.fromEntries(['PK','SK','reference','status','createdAt','expiresAt','requestHash','record'].map(key=>[key,structuredClone(item[key])]));if(manifest.original)assert.deepEqual(original,manifest.original);return original;
}
const childKey=SK=>typeof SK==='string'&&(/^(REVIEW|PREP_HISTORY)#[0-9]{12}$/.test(SK)||/^(REPLAY|PREP_REPLAY)#/.test(SK)&&canonicalUuid(SK.slice(SK.indexOf('#')+1)));
export function validatePreparationRows(rows,manifest){
 assert.ok(manifest.original);validatePreparationRoot(manifest.original,{...manifest,original:undefined});
 for(const row of rows){assert.equal(row.PK,`INTEREST#${manifest.application.reference}`);if(row.SK==='RECORD')validatePreparationRoot(row,manifest);else{assert.ok(childKey(row.SK));assert.equal(row.expiresAt,manifest.original.expiresAt);}}return rows;
}

export async function main(args=process.argv.slice(2)){
 const mode=args[0];assert.ok(args.length===1&&['--verify','--verify-browser','--cleanup'].includes(mode));
 const context=validateApplicationsContext(await interestDevelopmentResources());
 for(const key of ['TeamFunctionName','CatalogFunctionName'])assert.ok(context.outputs[key]?.startsWith(`${context.stackName}-`));
 await mkdir(directory,{recursive:true});assert.ok(!(await lstat(directory)).isSymbolicLink());
 const save=async(path,value)=>{const info=await lstat(path).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});assert.ok(!info||info.isFile()&&!info.isSymbolicLink());await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});};
 let quota=await existing(quotaFile),manifest=await existing(privateFile);
 if(!manifest&&mode==='--verify'){
  if(!quota){await quotaMain(['--prepare']);quota=await existing(quotaFile);}validateQuotaManifest(quota,context);assert.ok(!quota.verificationStartedAt&&!(quota.pendingSeeds??[]).length&&labels.every(label=>quota.actors[label].onboarded&&!quota.actors[label].deleted));
  const reference=randomUUID();manifest={version:1,runId:quota.runId,region:context.region,stackName:context.stackName,interestTable:context.interestTable,userPoolId:context.outputs.UserPoolId,actors:Object.fromEntries(labels.map(label=>[label,Object.fromEntries(['email','username','sub','organizationId'].map(field=>[field,quota.actors[label][field]]))])),application:{reference,body:preparationFixture(quota.runId,reference)},catalogId:`prep-${quota.runId}`,mutations:[]};await save(privateFile,manifest);
 }
 validatePreparationManifest(manifest,context,quota);const previous=await existing(reportFile),report={mode,runId:manifest.runId,startedAt:new Date().toISOString(),checks:[],billingEnabled:false,classification:{backend:'Real AWS Lambda via IAM with synthetic API envelopes; browser JWT separately verified.',accounts:'Three isolated suppressed-email QA accounts.',data:'One exact fictitious intake; catalog and membership evidence inside synthetic a workspace only.'}};
 const savePrivate=()=>save(privateFile,manifest);
 const saveReport=()=>save(reportFile,{...report,reference:manifest.application.reference,updatedAt:new Date().toISOString(),runs:[...(previous?.runId===manifest.runId?previous.runs??[]:[]).filter(run=>run.mode!==mode),{...report}]});
 const check=async(name,operation)=>{const entry={name,ok:false};report.checks.push(entry);try{const result=await operation();entry.ok=true;await saveReport();return result;}catch(error){entry.errorType=error.name;await saveReport();throw error;}};
 const cs=require('@aws-sdk/client-cognito-identity-provider'),ls=require('@aws-sdk/client-lambda'),ds=require('@aws-sdk/lib-dynamodb'),{DynamoDBClient}=require('@aws-sdk/client-dynamodb');
 const cognito=new cs.CognitoIdentityProviderClient({region:context.region}),lambda=new ls.LambdaClient({region:context.region}),db=ds.DynamoDBDocumentClient.from(new DynamoDBClient({region:context.region}));
 const {owner,a,b}=manifest.actors,ref=manifest.application.reference,operatorPath=`/pilot-applications/${ref}/preparation`,contactPath=`/pilot-onboarding/${ref}`;
 async function call(functionName,actor,method,path,body,expected=200,workspaceId=actor.organizationId){
  const [rawPath,rawQueryString='']=(`/api/v1${path}`).split('?');const event={version:'2.0',rawPath,rawQueryString,headers:{'x-organization-id':workspaceId},requestContext:{requestId:randomUUID(),http:{method},authorizer:{jwt:{claims:{sub:actor.sub,token_use:'access','cognito:groups':['cotitrama-pilot-reviewers',`org:${workspaceId}:admin`]}}}},...(body===undefined?{}:{body:JSON.stringify(body)})};
  const invoked=await lambda.send(new ls.InvokeCommand({FunctionName:functionName,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify(event))}));assert.ok(!invoked.FunctionError);const result=JSON.parse(Buffer.from(invoked.Payload).toString());assert.ok((Array.isArray(expected)?expected:[expected]).includes(result.statusCode),`Expected ${expected}; received ${result.statusCode}.`);return{status:result.statusCode,body:result.body?JSON.parse(result.body):undefined};
 }
 const app=(actor,method,path,body,expected=200)=>call(context.outputs.ApplicationsFunctionName,actor,method,path,body,expected);
 const team=(actor,method,path,body,expected=200,workspace=a.organizationId)=>call(context.outputs.TeamFunctionName,actor,method,`/team${path}`,body,expected,workspace);
 const catalog=(method,path,body,expected=200)=>call(context.outputs.CatalogFunctionName,a,method,`/catalogs${path}`,body,expected,a.organizationId);
 const root=async()=>{const item=(await db.send(new ds.GetCommand({TableName:context.interestTable,Key:{PK:`INTEREST#${ref}`,SK:'RECORD'},ConsistentRead:true}))).Item;const original=validatePreparationRoot(item,manifest);if(!manifest.original){manifest.original=original;await savePrivate();}return item;};
 const rows=async()=>{const all=[];let ExclusiveStartKey;for(let page=0;page<20;page++){const result=await db.send(new ds.QueryCommand({TableName:context.interestTable,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':`INTEREST#${ref}`},ConsistentRead:true,Limit:100,ExclusiveStartKey}));all.push(...(result.Items??[]));ExclusiveStartKey=result.LastEvaluatedKey;if(!ExclusiveStartKey)return all;assert.equal(ExclusiveStartKey.PK,`INTEREST#${ref}`);}throw new Error('QA partition budget exceeded.');};
 const mutation=async fields=>{const body={mutationId:randomUUID(),...fields};manifest.mutations.push(body);await savePrivate();return body;};
 const current=async()=>(await app(owner,'GET',operatorPath)).body;
 const agreements={participants:true,references:true,sessions:true,support:true,evidence:true};
 const futureDate=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 async function review(status){const item=await root();return app(owner,'PATCH',`/pilot-applications/${ref}`,await mutation({expectedVersion:item.review?.version??0,status,nextActionDate:'',note:'QA incorporación CotiTrama; sin comunicaciones.'}));}
 async function verifyActor(actor){const user=await cognito.send(new cs.AdminGetUserCommand({UserPoolId:manifest.userPoolId,Username:actor.username}));const attributes=Object.fromEntries(user.UserAttributes.map(row=>[row.Name,row.Value]));assert.equal(attributes.email,actor.email);assert.equal(attributes.sub,actor.sub);return user;}
 try{
  if(mode==='--cleanup'){
   await check('cleanup-only-recorded-intake-and-review-preparation-children',async()=>{const item=(await db.send(new ds.GetCommand({TableName:context.interestTable,Key:{PK:`INTEREST#${ref}`,SK:'RECORD'},ConsistentRead:true}))).Item;if(item){manifest.original??=validatePreparationRoot(item,manifest);await savePrivate();}const ownRows=await rows();if(ownRows.length){validatePreparationRows(ownRows,manifest);for(const item of ownRows.filter(row=>row.SK!=='RECORD'))await db.send(new ds.DeleteCommand({TableName:context.interestTable,Key:{PK:item.PK,SK:item.SK},ConditionExpression:'expiresAt = :expires',ExpressionAttributeValues:{':expires':manifest.original.expiresAt}}));if(ownRows.some(row=>row.SK==='RECORD'))await db.send(new ds.DeleteCommand({TableName:context.interestTable,Key:{PK:`INTEREST#${ref}`,SK:'RECORD'},ConditionExpression:'requestHash = :hash AND expiresAt = :expires',ExpressionAttributeValues:{':hash':hash(manifest.application.body),':expires':manifest.original.expiresAt}}));}assert.equal((await rows()).length,0);});
   await check('cleanup-only-three-recorded-synthetic-accounts',async()=>{if(quota&&!quota.actors.owner.deleted){await verifyActor(owner);await reviewerAccess(context,owner.email,'revoke',{client:cognito});}if(quota)await quotaMain(['--cleanup']);else assert.ok(manifest.accountsCleaned);manifest.accountsCleaned=true;await savePrivate();});
   report.ok=true;report.cleanup={ownIntakeRemoved:true,dailyCounterPreserved:true,onlyQaAccountsRemoved:true,syntheticCommercialEvidenceRetained:true};await saveReport();await unlink(privateFile);console.log('Preparation cleanup passed; only own QA intake/accounts removed.');return report;
  }
  assert.ok(quota&&labels.every(label=>!quota.actors[label].deleted));
  if(mode==='--verify-browser'){
   assert.ok(manifest.verificationCompletedAt);await check('browser-preparation-changes-persist-and-original-deadline-is-unchanged',async()=>{const result=await current();assert.equal(result.readiness.state,'ready');assert.ok(result.preparation.version>manifest.verificationVersion);assert.equal(result.preparation.plannedStartDate,manifest.expectedBrowserDate);const history=(await app(owner,'GET',`${operatorPath}/history`)).body;assert.ok(history.items.some(item=>item.kind==='agreements'&&item.plannedStartDate===manifest.expectedBrowserDate&&item.version===result.preparation.version));await root();validatePreparationRows(await rows(),manifest);report.reviewVersion=result.preparation.version;report.plannedStartDate=result.preparation.plannedStartDate;});report.ok=true;await saveReport();console.log('Browser preparation persistence verified.');return report;
  }
  assert.ok(!manifest.verificationStartedAt);manifest.verificationStartedAt=new Date().toISOString();await savePrivate();
  await check('preselection-gates-preparation-and-contact-reference-is-not-a-credential',async()=>{
   await verifyActor(owner);await reviewerAccess(context,owner.email,'grant',{client:cognito});const response=await fetch(`${origin}/api/v1/pilot-interest`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(manifest.application.body)});assert.equal(response.status,202);await root();await app(owner,'GET',operatorPath,undefined,409);await app(b,'GET',contactPath,undefined,404);await review('selected');
   for(const [method,path] of [['GET',operatorPath],['PATCH',operatorPath],['GET',`${operatorPath}/history`],['GET',contactPath],['POST',`${contactPath}/link`],['POST',`${contactPath}/catalog`]])assert.equal((await fetch(`${origin}/api/v1${path}`,{method,...(method==='GET'?{}:{headers:{'content-type':'application/json'},body:'{}'})})).status,401);
   await app(b,'GET',operatorPath,undefined,403);await app(owner,'GET',contactPath,undefined,404);await app(b,'GET',contactPath,undefined,404);
  });
  await check('contact-explicitly-links-only-an-admin-workspace-with-versioned-consent',async()=>{
   const contextResult=(await app(a,'GET',contactPath)).body;assert.ok(contextResult.adminWorkspaces.some(space=>space.workspaceId===a.organizationId));assert.ok(!contextResult.adminWorkspaces.some(space=>space.workspaceId===owner.organizationId));
   const link=await mutation({expectedVersion:0,workspaceId:a.organizationId,participationConsent:true,sharingConsent:true,consentVersion:'2026-11-19'});
   await app(a,'POST',`${contactPath}/link`,{...link,workspaceId:owner.organizationId},403);await app(a,'POST',`${contactPath}/link`,{...link,sharingConsent:false},400);
   const result=(await app(a,'POST',`${contactPath}/link`,link)).body;assert.equal(result.preparation.version,1);assert.deepEqual((await app(a,'POST',`${contactPath}/link`,link)).body.preparation,result.preparation);await app(a,'POST',`${contactPath}/link`,{...link,workspaceId:owner.organizationId},409);
   const progress=await current();assert.equal(progress.readiness.access.adminReady,true);assert.equal(progress.readiness.access.sellerReady,false);assert.notEqual(progress.readiness.state,'ready');
  });
  await check('authorized-published-catalog-and-manual-agreements-still-require-current-seller-access',async()=>{
   const document={...structuredClone(syntheticCatalog),catalogId:manifest.catalogId,name:'Catálogo ficticio de preparación'};await catalog('POST',`/${manifest.catalogId}/publications`,document,201);
   const selection=await mutation({expectedVersion:(await current()).preparation.version,catalogId:manifest.catalogId,version:1,catalogAuthorized:true,consentVersion:'2026-11-19'});const picked=(await app(a,'POST',`${contactPath}/catalog`,selection)).body;assert.equal(picked.readiness.catalog.ready,true);
   const manual=await mutation({expectedVersion:picked.preparation.version,agreements,plannedStartDate:futureDate});const pending=(await app(owner,'PATCH',operatorPath,manual)).body;assert.notEqual(pending.readiness.state,'ready');assert.equal(pending.readiness.access.sellerReady,false);
   for(const field of ['basePriceMinor','products','rules','priceMinor'])assert.ok(!JSON.stringify(pending).includes(`"${field}"`));for(const actor of Object.values(manifest.actors))assert.ok(!JSON.stringify(pending).includes(actor.email));
   const invitation=(await team(a,'POST','/invitations',{email:b.email,role:'seller'},201)).body;manifest.invitation=invitation;await savePrivate();await team(b,'POST',`/invitations/${invitation.token}/accept`,{},200,a.organizationId);const ready=await current();assert.equal(ready.readiness.state,'ready');assert.equal(ready.readiness.access.verifiedMembers,2);
  });
  await check('readiness-rechecks-role-account-and-archived-catalog-without-changing-business-data',async()=>{
   await team(a,'PATCH',`/members/${b.sub}`,{role:'reader'});assert.equal((await current()).readiness.access.sellerReady,false);await team(a,'PATCH',`/members/${b.sub}`,{role:'seller'});
   await verifyActor(b);await cognito.send(new cs.AdminDisableUserCommand({UserPoolId:manifest.userPoolId,Username:b.username}));try{assert.equal((await current()).readiness.access.sellerReady,false);}finally{await cognito.send(new cs.AdminEnableUserCommand({UserPoolId:manifest.userPoolId,Username:b.username}));}
   await catalog('PATCH',`/${manifest.catalogId}/status`,{active:false});assert.equal((await current()).readiness.catalog.ready,false);await catalog('PATCH',`/${manifest.catalogId}/status`,{active:true});
   const v2={...structuredClone(syntheticCatalog),catalogId:manifest.catalogId,name:'Catálogo ficticio de preparación',version:2};v2.products[0].basePriceMinor='9999900';await catalog('POST',`/${manifest.catalogId}/publications`,v2,201);const ready=await current();assert.equal(ready.readiness.state,'ready');assert.equal(ready.readiness.catalog.version,1);
  });
  await check('withdrawal-pauses-preparation-and-concurrent-checklists-do-not-overwrite',async()=>{
   await review('withdrawn');await app(owner,'GET',operatorPath,undefined,409);await app(a,'GET',contactPath,undefined,409);await review('selected');
   const expectedVersion=(await current()).preparation.version,one=await mutation({expectedVersion,agreements:{...agreements,references:false},plannedStartDate:futureDate}),two=await mutation({expectedVersion,agreements:{...agreements,support:false},plannedStartDate:futureDate});const results=await Promise.all([app(owner,'PATCH',operatorPath,one,[200,409]),app(owner,'PATCH',operatorPath,two,[200,409])]);assert.deepEqual(results.map(value=>value.status).sort(),[200,409]);
   const restore=await mutation({expectedVersion:(await current()).preparation.version,agreements,plannedStartDate:futureDate});const final=(await app(owner,'PATCH',operatorPath,restore)).body;assert.equal(final.readiness.state,'ready');manifest.verificationVersion=final.preparation.version;await savePrivate();const history=(await app(owner,'GET',`${operatorPath}/history`)).body;assert.equal(history.items.length,final.preparation.version);await root();validatePreparationRows(await rows(),manifest);
  });
  manifest.verificationCompletedAt=new Date().toISOString();manifest.expectedBrowserDate=new Date(Date.parse(`${futureDate}T00:00:00.000Z`)+86400000).toISOString().slice(0,10);await savePrivate();report.ok=true;report.preparationVersion=manifest.verificationVersion;report.browser={operatorUrl:`${origin}/piloto/preparacion/${ref}`,contactUrl:`${origin}/piloto/incorporacion/${ref}`,catalogId:manifest.catalogId,plannedStartDate:manifest.expectedBrowserDate,note:'Save the recorded plannedStartDate from the operator browser with all agreements confirmed.'};await saveReport();console.log('Preparation AWS acceptance passed; browser JWT verification remains separate.');return report;
 }catch(error){report.ok=false;report.failure={name:error.name,check:report.checks.at(-1)?.name};await saveReport();throw error;}
 finally{cognito.destroy();lambda.destroy();db.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(`Preparation QA failed (${error.name}); see ignored report. No credentials printed.`);process.exitCode=1;});
