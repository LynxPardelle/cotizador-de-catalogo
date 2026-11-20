import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {lstat,mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {interestDevelopmentResources,validateInterestTable} from './pilot-interest-development.mjs';
import {main as quotaMain,validateQuotaManifest} from './quota-smoke.mjs';
import {reviewerAccess,REVIEWER_GROUP} from './pilot-reviewer-development.mjs';
import {interestRequest} from '../services/interest/domain.mjs';
import {hash,validUuid} from '../services/shared/http.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),directory=join(root,'artifacts');
const privateFile=join(directory,'applications-qa-private.json'),reportFile=join(directory,'applications-smoke.json'),quotaFile=join(directory,'quota-qa-private.json');
const require=createRequire(new URL('../services/package.json',import.meta.url));
const labels=['owner','a','b'],origin='https://cotitrama-dev.lynxpardelle.com',endpoint='/api/v1/pilot-applications';
const runPattern=/^[0-9]{8,17}-[a-f0-9]{6,12}$/;
export const browserNote='QA navegador CotiTrama: seguimiento manual.';
const lowerUuid=value=>validUuid(value)&&value===value.toLowerCase();
const ownKey=(reference,SK='RECORD')=>({PK:`INTEREST#${reference}`,SK});
const existingJson=path=>readFile(path,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});

export function applicationFixture(runId,reference){
  assert.match(runId??'',runPattern);assert.ok(lowerUuid(reference),'Only a canonical recorded QA reference is allowed.');
  return interestRequest({requestId:reference,organizationName:`Organización ficticia CotiTrama QA ${runId}`,contactEmail:`ct-applications-${runId}@example.invalid`,sector:'Prueba sintética',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'});
}
export function validateApplicationsContext(context){
  validateInterestTable(context,context?.interestTable);
  assert.match(context.outputs.UserPoolId??'',/^us-east-1_[A-Za-z0-9]+$/);
  assert.ok(context.outputs.ApplicationsFunctionName?.startsWith('cotitrama-development-ApplicationsFunction-'));
  return context;
}
export function validateApplicationsManifest(manifest,context,quota){
  validateApplicationsContext(context);assert.equal(manifest?.version,1);assert.match(manifest.runId??'',runPattern);
  assert.equal(manifest.stackName,context.stackName);assert.equal(manifest.region,context.region);assert.equal(manifest.userPoolId,context.outputs.UserPoolId);assert.equal(manifest.interestTable,context.interestTable);
  assert.deepEqual(Object.keys(manifest.actors??{}).sort(),[...labels].sort());
  for(const label of labels){const actor=manifest.actors[label];assert.equal(actor.email,`ct-quota-${label}-${manifest.runId}@example.invalid`);assert.ok(lowerUuid(actor.sub));assert.ok(actor.username===actor.email||lowerUuid(actor.username));}
  assert.ok(lowerUuid(manifest.application?.reference));assert.deepEqual(manifest.application.body,applicationFixture(manifest.runId,manifest.application.reference));
  if(quota){validateQuotaManifest(quota,context);assert.equal(quota.runId,manifest.runId);for(const label of labels)for(const field of ['email','username','sub'])assert.equal(manifest.actors[label][field],quota.actors[label][field]);}
  if(manifest.original)validateApplicationRoot(manifest.original,{...manifest,original:undefined});
  return manifest;
}
export function validateApplicationRoot(item,manifest){
  const {reference,body}=manifest.application;assert.deepEqual(body,applicationFixture(manifest.runId,reference));
  assert.ok(item&&typeof item==='object');assert.equal(item.PK,`INTEREST#${reference}`);assert.equal(item.SK,'RECORD');assert.equal(item.reference,reference);assert.equal(item.status,'received');assert.equal(item.requestHash,hash(body));
  assert.equal(typeof item.createdAt,'string');assert.ok(Number.isFinite(Date.parse(item.createdAt)));assert.equal(new Date(item.createdAt).toISOString(),item.createdAt);
  assert.equal(item.expiresAt,Math.floor(Date.parse(item.createdAt)/1000)+90*86400);
  assert.deepEqual(item.record,{...body,status:'received',createdAt:item.createdAt,acceptedAt:item.createdAt,expiresAt:item.expiresAt});
  const original=Object.fromEntries(['PK','SK','reference','status','createdAt','expiresAt','requestHash','record'].map(field=>[field,structuredClone(item[field])]));
  if(manifest.original)assert.deepEqual(original,manifest.original,'The original intake, hash, status and deadline must remain immutable.');return original;
}
function validChildKey(item,reference){return item?.PK===`INTEREST#${reference}`&&typeof item.SK==='string'&&(/^REVIEW#[0-9]{12}$/.test(item.SK)&&item.SK!=='REVIEW#000000000000'||item.SK.startsWith('REPLAY#')&&lowerUuid(item.SK.slice(7)));}
export function validateApplicationRows(rows,manifest){
  assert.ok(manifest.original,'A captured exact synthetic intake is required before child cleanup.');validateApplicationRoot(manifest.original,{...manifest,original:undefined});
  for(const item of rows){if(item.SK==='RECORD')validateApplicationRoot(item,manifest);else{assert.ok(validChildKey(item,manifest.application.reference),'Cleanup accepts only recorded review/replay keys inside this synthetic partition.');assert.equal(item.expiresAt,manifest.original.expiresAt,'Child retention must match the original intake.');}}
  return rows;
}

export async function main(args=process.argv.slice(2)){
  const mode=args[0];assert.ok(['--verify','--advance','--verify-browser','--cleanup'].includes(mode)&&args.length===(mode==='--advance'?2:1),'Use --verify, --advance recorded-reference, --verify-browser or --cleanup.');
  const context=validateApplicationsContext(await interestDevelopmentResources());
  await mkdir(directory,{recursive:true});const info=await lstat(directory);assert.ok(info.isDirectory()&&!info.isSymbolicLink(),'QA artifacts must be a real local directory.');
  const save=async(path,value)=>{const prior=await lstat(path).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});assert.ok(!prior||prior.isFile()&&!prior.isSymbolicLink());await writeFile(path,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});};
  let quota=await existingJson(quotaFile),manifest=await existingJson(privateFile);
  if(!manifest&&mode==='--verify'){
    if(!quota||labels.some(label=>!quota.actors?.[label]?.onboarded)){await quotaMain(['--prepare']);quota=await existingJson(quotaFile);}
    validateQuotaManifest(quota,context);assert.ok(!quota.verificationStartedAt,'Prepare a fresh quota run; these actors cannot be shared with a quota acceptance run.');assert.equal((quota.pendingSeeds??[]).length,0);
    assert.ok(labels.every(label=>quota.actors[label].created&&quota.actors[label].onboarded&&!quota.actors[label].deleted));
    const reference=randomUUID();manifest={version:1,runId:quota.runId,createdAt:new Date().toISOString(),region:context.region,stackName:context.stackName,userPoolId:context.outputs.UserPoolId,interestTable:context.interestTable,actors:Object.fromEntries(labels.map(label=>[label,Object.fromEntries(['email','username','sub'].map(field=>[field,quota.actors[label][field]]))])),application:{reference,body:applicationFixture(quota.runId,reference)},mutations:[]};
    // This journal exists before the public POST, including an ambiguous transport failure.
    await save(privateFile,manifest);
  }
  assert.ok(manifest,'No recorded applications QA run exists.');validateApplicationsManifest(manifest,context,quota);
  const previousReport=await existingJson(reportFile),report={mode,runId:manifest.runId,startedAt:new Date().toISOString(),checks:[],billingEnabled:false,classification:{accounts:'Three recorded synthetic users with suppressed email; no real account is changed.',backend:'Deployed AWS Lambda invoked by IAM with synthetic API envelopes. Browser JWT acceptance is separate.',data:'One exact synthetic public intake and its own review/replay partition.'}};
  const savePrivate=()=>save(privateFile,manifest);
  const saveReport=()=>save(reportFile,{...report,reference:manifest.application.reference,updatedAt:new Date().toISOString(),runs:[...(previousReport?.runId===manifest.runId?previousReport.runs??[]:[]).filter(run=>run.mode!==mode),{...report}]});
  const check=async(name,operation)=>{const entry={name,ok:false};report.checks.push(entry);try{const result=await operation();entry.ok=true;await saveReport();return result;}catch(error){entry.errorType=error?.name??'Error';await saveReport();throw error;}};
  const cs=require('@aws-sdk/client-cognito-identity-provider'),ls=require('@aws-sdk/client-lambda'),ds=require('@aws-sdk/lib-dynamodb'),{DynamoDBClient}=require('@aws-sdk/client-dynamodb');
  const cognito=new cs.CognitoIdentityProviderClient({region:context.region,maxAttempts:3}),lambda=new ls.LambdaClient({region:context.region,maxAttempts:3}),database=ds.DynamoDBDocumentClient.from(new DynamoDBClient({region:context.region,maxAttempts:3}));
  const reference=manifest.application.reference,owner=manifest.actors.owner;
  const status=(result,expected)=>{assert.ok((Array.isArray(expected)?expected:[expected]).includes(result.status),`Expected HTTP ${expected}; received ${result.status}.`);return result;};
  async function api(actor,method,suffix='',body,expected=200,{forged=false}={}){
    const path=`${endpoint}${suffix}`,parts=path.split('?'),event={version:'2.0',rawPath:parts[0],rawQueryString:parts[1]??'',headers:{'content-type':'application/json','x-organization-id':'forged-organization'},requestContext:{requestId:randomUUID(),http:{method,path:parts[0]},authorizer:{jwt:{claims:{sub:actor.sub,token_use:'access',scope:'openid',...(forged?{'cognito:groups':[REVIEWER_GROUP,'org:forged-organization:admin']}: {})}}}},isBase64Encoded:false,...(body===undefined?{}:{body:JSON.stringify(body)})};
    const result=await lambda.send(new ls.InvokeCommand({FunctionName:context.outputs.ApplicationsFunctionName,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify(event))}));assert.ok(!result.FunctionError,'The deployed application Lambda failed.');const payload=JSON.parse(Buffer.from(result.Payload).toString('utf8'));return status({status:payload.statusCode,body:payload.body?JSON.parse(payload.body):undefined},expected);
  }
  const publicSubmit=async()=>{const response=await fetch(`${origin}/api/v1/pilot-interest`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(manifest.application.body)});return status({status:response.status,body:await response.json()},202);};
  const getRoot=async()=>{const result=await database.send(new ds.GetCommand({TableName:context.interestTable,Key:ownKey(reference),ConsistentRead:true}));return result.Item;};
  async function original(){const item=await getRoot();const captured=validateApplicationRoot(item,manifest);if(!manifest.original){manifest.original=captured;await savePrivate();}return item;}
  async function rows(){const result=[];let ExclusiveStartKey;for(let page=0;page<20;page++){const response=await database.send(new ds.QueryCommand({TableName:context.interestTable,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':`INTEREST#${reference}`},ConsistentRead:true,Limit:100,ExclusiveStartKey}));result.push(...(response.Items??[]));ExclusiveStartKey=response.LastEvaluatedKey;if(!ExclusiveStartKey)return result;assert.ok(ExclusiveStartKey.PK===`INTEREST#${reference}`&&(ExclusiveStartKey.SK==='RECORD'||validChildKey(ExclusiveStartKey,reference)));}throw new Error('The synthetic partition exceeded its cleanup read budget.');}
  async function mutation(value){const body={mutationId:randomUUID(),...value};manifest.mutations.push(body);await savePrivate();return body;}
  async function setReviewer(operation){manifest.reviewerMayBeGranted=operation==='grant';await savePrivate();return reviewerAccess(context,owner.email,operation,{client:cognito});}
  try{
    if(mode==='--cleanup'){
      await check('delete-only-recorded-synthetic-interest-review-replay-partition',async()=>{
        const item=await getRoot();if(item){const captured=validateApplicationRoot(item,manifest);if(!manifest.original){manifest.original=captured;await savePrivate();}}
        const recorded=await rows();if(recorded.length){validateApplicationRows(recorded,manifest);for(const row of recorded.filter(row=>row.SK!=='RECORD'))await database.send(new ds.DeleteCommand({TableName:context.interestTable,Key:ownKey(reference,row.SK),ConditionExpression:'#expiresAt = :expiresAt',ExpressionAttributeNames:{'#expiresAt':'expiresAt'},ExpressionAttributeValues:{':expiresAt':manifest.original.expiresAt}}));
          if(recorded.some(row=>row.SK==='RECORD'))await database.send(new ds.DeleteCommand({TableName:context.interestTable,Key:ownKey(reference),ConditionExpression:'#requestHash = :hash AND #expiresAt = :expiresAt AND #status = :received',ExpressionAttributeNames:{'#requestHash':'requestHash','#expiresAt':'expiresAt','#status':'status'},ExpressionAttributeValues:{':hash':hash(manifest.application.body),':expiresAt':manifest.original.expiresAt,':received':'received'}}));}
        assert.equal((await rows()).length,0);manifest.applicationDeleted=true;await savePrivate();
      });
      await check('revoke-and-clean-only-three-recorded-synthetic-accounts',async()=>{
        if(quota&&!quota.actors.owner.deleted)await setReviewer('revoke');
        if(quota){validateQuotaManifest(quota,context);assert.equal(quota.runId,manifest.runId);await quotaMain(['--cleanup']);}else assert.ok(manifest.accountsCleaned,'The recorded quota credential journal is missing; do not guess account cleanup.');
        manifest.accountsCleaned=true;await savePrivate();
      });
      report.ok=true;report.cleanup={syntheticPartitionDeleted:true,dailyIntakeCounterPreserved:true,onlyRecordedSyntheticAccountsRemoved:true};await saveReport();await unlink(privateFile);console.log('Applications QA cleanup passed; daily intake accounting was preserved.');return report;
    }
    assert.ok(quota&&labels.every(label=>quota.actors[label].created&&quota.actors[label].onboarded&&!quota.actors[label].deleted),'The recorded synthetic accounts must still exist.');
    if(mode==='--advance'){
      assert.equal(args[1],reference,'Only the recorded synthetic application may be advanced.');assert.ok(manifest.verificationCompletedAt);await original();
      await check('advance-only-recorded-synthetic-review-for-browser-conflict',async()=>{const current=(await api(owner,'GET',`/${reference}`)).body;if(!manifest.advance){manifest.advance=await mutation({expectedVersion:current.review.version,status:'contacted',nextActionDate:'',note:'QA avance concurrente CotiTrama.'});await savePrivate();}const result=(await api(owner,'PATCH',`/${reference}`,manifest.advance)).body;assert.equal(result.review.version,manifest.advance.expectedVersion+1);manifest.latestReview=result.review;manifest.advancedAt=new Date().toISOString();await savePrivate();await original();report.reviewVersion=result.review.version;});
      report.ok=true;await saveReport();console.log('Recorded synthetic review advanced for browser conflict verification.');return report;
    }
    if(mode==='--verify-browser'){
      assert.ok(manifest.verificationCompletedAt);await check('persisted-browser-follow-up-and-history-keep-original-intake-immutable',async()=>{const current=(await api(owner,'GET',`/${reference}`)).body,history=(await api(owner,'GET',`/${reference}/history`)).body;assert.equal(current.review.status,'needs_info');assert.equal(current.review.nextActionDate,'');assert.ok(current.review.version>manifest.verificationReview.version);assert.ok(history.items.some(event=>event.version===current.review.version&&event.note===browserNote&&event.status==='needs_info'));await original();validateApplicationRows(await rows(),manifest);manifest.browserVerifiedAt=new Date().toISOString();manifest.browserReviewVersion=current.review.version;await savePrivate();report.reviewVersion=current.review.version;});report.ok=true;report.browserPersistenceVerified=true;await saveReport();console.log('Browser follow-up persistence verified; original synthetic intake is immutable.');return report;
    }
    assert.equal(mode,'--verify');assert.ok(!manifest.verificationStartedAt,'Verification already started. Clean up this recorded run before preparing another.');manifest.verificationStartedAt=new Date().toISOString();await savePrivate();
    await check('public-synthetic-intake-is-journaled-before-post-and-keeps-one-receipt',async()=>{const receipt=(await publicSubmit()).body;assert.deepEqual(receipt,{reference,status:'received'});await original();assert.deepEqual((await publicSubmit()).body,receipt);});
    await check('anonymous-api-gateway-and-ordinary-org-admins-cannot-review',async()=>{
      const refused={mutationId:randomUUID(),expectedVersion:0,status:'selected',nextActionDate:'',note:'Forbidden synthetic mutation.'};
      for(const suffix of ['/context','',`/${reference}`,`/${reference}/history`])assert.equal((await fetch(`${origin}${endpoint}${suffix}`)).status,401);
      assert.equal((await fetch(`${origin}${endpoint}/${reference}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(refused)})).status,401);
      for(const label of ['a','b']){const actor=manifest.actors[label];for(const suffix of ['/context','',`/${reference}`,`/${reference}/history`])await api(actor,'GET',suffix,undefined,403,{forged:true});await api(actor,'PATCH',`/${reference}`,refused,403,{forged:true});}
    });
    await check('current-cognito-reviewer-grant-and-revocation-override-the-same-jwt-envelope',async()=>{await setReviewer('grant');assert.deepEqual((await api(owner,'GET','/context',undefined,200,{forged:true})).body,{allowed:true});await setReviewer('revoke');try{await api(owner,'GET','/context',undefined,403,{forged:true});}finally{await setReviewer('grant');}assert.deepEqual((await api(owner,'GET','/context',undefined,200,{forged:true})).body,{allowed:true});});
    await check('bounded-list-detail-and-empty-history-include-the-legacy-synthetic-request',async()=>{
      let cursor,found=false;for(let page=0;page<20;page++){const list=(await api(owner,'GET',`?status=received${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`)).body;assert.ok(list.items.length<=25&&list.scannedCount<=100);assert.ok(list.items.every(item=>!Object.hasOwn(item,'contactEmail')&&!Object.hasOwn(item,'application')&&!Object.hasOwn(item,'note')));found||=list.items.some(item=>item.reference===reference&&item.review.version===0);cursor=list.nextCursor;if(found||!cursor)break;}assert.equal(found,true,'The own synthetic legacy record was not reached within the explicit list budget.');const detail=(await api(owner,'GET',`/${reference}`)).body;assert.deepEqual(detail.application,manifest.original.record);assert.equal(detail.review.version,0);assert.deepEqual((await api(owner,'GET',`/${reference}/history`)).body.items,[]);
    });
    await check('optimistic-update-identical-replay-changed-payload-and-concurrent-review-race',async()=>{
      const first=await mutation({expectedVersion:0,status:'reviewing',nextActionDate:'',note:'QA revisión inicial CotiTrama.'}),result=(await api(owner,'PATCH',`/${reference}`,first)).body;assert.equal(result.review.version,1);assert.deepEqual((await api(owner,'PATCH',`/${reference}`,first)).body,result);assert.equal((await api(owner,'PATCH',`/${reference}`,{...first,note:'Changed retry.'},409)).body.error.code,'CONFLICT');
      const attempts=[];for(const [index,next] of ['contacted','needs_info'].entries())attempts.push(await mutation({expectedVersion:1,status:next,nextActionDate:'',note:`QA concurrencia ${index+1} CotiTrama.`}));
      const results=await Promise.all(attempts.map(body=>api(owner,'PATCH',`/${reference}`,body,[200,409])));assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);assert.equal(results.find(result=>result.status===409).body.error.code,'REVIEW_CONFLICT');const winner=results.find(result=>result.status===200).body;assert.equal(winner.review.version,2);manifest.latestReview=winner.review;manifest.verificationReview=winner.review;await savePrivate();
      const stale=await mutation({expectedVersion:1,status:'selected',nextActionDate:'',note:'QA stale version.'});assert.equal((await api(owner,'PATCH',`/${reference}`,stale,409)).body.error.code,'REVIEW_CONFLICT');
      const history=(await api(owner,'GET',`/${reference}/history`)).body;assert.deepEqual(history.items.map(event=>event.version),[2,1]);assert.ok(history.items.every(event=>event.actorKey===hash({subject:owner.sub})&&!Object.values(event).includes(owner.sub)));await original();validateApplicationRows(await rows(),manifest);assert.deepEqual((await publicSubmit()).body,{reference,status:'received'});
    });
    manifest.verificationCompletedAt=new Date().toISOString();await savePrivate();report.ok=true;report.reviewVersion=manifest.latestReview.version;report.browser={url:`${origin}/piloto/solicitudes`,reference,note:browserNote,status:'needs_info',nextActionDate:'',conflictCommand:`node --use-system-ca tools/applications-smoke.mjs --advance ${reference}`};await saveReport();console.log('Applications AWS acceptance passed. Report: artifacts/applications-smoke.json. Browser JWT verification remains separate.');return report;
  }catch(error){report.ok=false;report.failure={name:error?.name??'Error',check:report.checks.at(-1)?.name??'prepare'};await saveReport();throw error;}
  finally{cognito.destroy();lambda.destroy();database.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(`Applications AWS QA failed (${error?.name??'Error'}). Review the ignored applications report; no account details or credentials printed.`);process.exitCode=1;});
