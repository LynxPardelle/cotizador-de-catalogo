import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { developmentResources } from './plan-development.mjs';
import { main as quotaMain, validateQuotaManifest } from './quota-smoke.mjs';
import { syntheticCatalog } from '../services/fixtures/catalog.mjs';

const require=createRequire(new URL('../services/package.json',import.meta.url));
const privateFile=new URL('../artifacts/quota-qa-private.json',import.meta.url);
const reportFile=new URL('../artifacts/pilot-metrics-aws.json',import.meta.url);
const labels=['owner','a','b'];

export function validatePilotFixture(manifest,context) {
  validateQuotaManifest(manifest,context);
  for(const key of ['MembersTable','CatalogTable','QuotesTable']) assert.ok(context.tables[key]?.startsWith(`${context.stackName}-${key}-`));
  for(const label of labels) {const actor=manifest.actors[label];assert.ok(actor.created && actor.onboarded && !actor.deleted);}
  assert.equal(new Set(labels.map(label=>manifest.actors[label].organizationId)).size,3);
  return manifest;
}
export function assertAggregatePrivacy(value,forbiddenValues=[]) {
  const visit=input=>{
    if(!input || typeof input!=='object') return;
    for(const [key,item] of Object.entries(input)) {
      assert.ok(!['sub','subject','email','actorkey','actorid','userid','username','organizationid','token','ip','clientip'].includes(key.toLowerCase()),'A dashboard must not expose private identity fields.');
      visit(item);
    }
  };
  visit(value);const serialized=JSON.stringify(value);
  for(const secret of forbiddenValues) if(typeof secret==='string' && secret) assert.ok(!serialized.includes(secret),'Private actor data leaked into an aggregate response.');
}
async function save(path,value,privateData=false) {
  const existing=await lstat(path).catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
  assert.ok(!existing?.isSymbolicLink());await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:privateData ? 0o600 : 0o644});
}
const readJson=async path=>{assert.ok(!(await lstat(path)).isSymbolicLink());return JSON.parse(await readFile(path,'utf8'));};

export async function main(args=process.argv.slice(2)) {
  assert.ok(args.length===1 && ['--prepare','--verify','--browser','--cleanup'].includes(args[0]),'Use --prepare, --verify, --browser, or --cleanup.');
  const mode=args[0];
  if(mode==='--prepare') await quotaMain(['--prepare']);
  const context=await developmentResources(),{outputs,region}=context;
  const previous=await readJson(reportFile).catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
  if(mode==='--cleanup') {
    await quotaMain(['--cleanup']);
    const result={...(previous ?? {}),cleanup:{recordedQaUsersDeleted:true,privateCredentialsRemoved:true,syntheticDynamoDbEvidenceRetained:true,completedAt:new Date().toISOString()}};
    await save(reportFile,result);console.log('Pilot metrics QA accounts cleaned; aggregate acceptance evidence retained.');return result;
  }
  const manifest=validatePilotFixture(await readJson(privateFile),context);
  const report={mode,runId:manifest.runId,startedAt:new Date().toISOString(),stackName:context.stackName,region,checks:[],classification:{accounts:'Three suppressed synthetic quota QA accounts.',business:'Real AWS functions invoked by IAM with HTTP API v2 envelopes; browser JWT verification is separate.',time:'Synthetic declared duration fixtures; no observed human productivity or savings.',corrections:'Declared synthetic incidents; no claim that pricing errors were resolved.'}};
  const savePrivate=()=>save(privateFile,manifest,true);
  const saveReport=()=>{
    const same=previous?.runId===manifest.runId ? previous : undefined;
    return save(reportFile,{...report,runs:[...(same?.runs ?? []).filter(run=>run.mode!==mode),{...report}],updatedAt:new Date().toISOString()});
  };
  if(mode==='--prepare') {report.ok=true;report.prepared=true;report.privateCredentialsPath='artifacts/quota-qa-private.json';await saveReport();console.log('Pilot metrics QA prepared with isolated synthetic accounts.');return report;}
  const cs=require('@aws-sdk/client-cognito-identity-provider'),ls=require('@aws-sdk/client-lambda');
  const cognito=new cs.CognitoIdentityProviderClient({region,maxAttempts:3}),lambda=new ls.LambdaClient({region,maxAttempts:3});
  for(const key of ['TeamFunctionName','CatalogFunctionName','QuotesFunctionName']) assert.ok(outputs[key]?.startsWith(`${context.stackName}-`));
  const secrets=labels.flatMap(label=>[manifest.actors[label].email,manifest.actors[label].sub,manifest.actors[label].password]);
  async function check(name,operation) {
    const entry={name,ok:false};report.checks.push(entry);
    try {const value=await operation();entry.ok=true;await saveReport();console.log(`Pilot metrics QA passed: ${name}.`);return value;}
    catch(error) {entry.errorType=error?.name ?? 'Error';await saveReport();throw error;}
  }
  async function call(functionName,actor,method,path,body,expected=200,key,organizationId=actor.organizationId) {
    const url=new URL(path,'https://synthetic.invalid');
    const event={version:'2.0',rawPath:`/api/v1${url.pathname}`,rawQueryString:url.search.slice(1),queryStringParameters:Object.fromEntries(url.searchParams),headers:{'x-organization-id':organizationId,...(key ? {'idempotency-key':key} : {})},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{requestId:`pilot-qa-${randomUUID()}`,http:{method},authorizer:{jwt:{claims:{sub:actor.sub,token_use:'access','cognito:groups':[actor.group]}}}}};
    const result=await lambda.send(new ls.InvokeCommand({FunctionName:functionName,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify(event))}));
    assert.ok(!result.FunctionError && result.Payload,'Pilot AWS function failed.');const http=JSON.parse(Buffer.from(result.Payload).toString('utf8'));
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(http.statusCode),'Unexpected pilot HTTP result.');
    return {status:http.statusCode,body:http.body ? JSON.parse(http.body) : undefined};
  }
  const team=(actor,method,path,body,status=200,org)=>call(outputs.TeamFunctionName,actor,method,`/team${path}`,body,status,undefined,org);
  const catalog=(actor,method,path,body,status=200)=>call(outputs.CatalogFunctionName,actor,method,`/catalogs${path}`,body,status);
  const quote=(actor,method,path,body,status=200,key,org)=>call(outputs.QuotesFunctionName,actor,method,`/quotes${path}`,body,status,key,org);
  const {owner,a}=manifest.actors;
  const catalogId=`pilot-${manifest.runId}`;
  const document={...structuredClone(syntheticCatalog),catalogId,name:'Catálogo sintético de métricas'};
  const request={catalogId,version:1,currency:'MXN',items:[{productId:'desk',quantity:1,optionIds:[]}]};
  async function assertMetrics(days,expectedQuotes=3) {
    const metrics=(await quote(owner,'GET',`/metrics?days=${days}`)).body;assertAggregatePrivacy(metrics,secrets);
    assert.equal(metrics.window.days,days);assert.ok(Number.isFinite(Date.parse(metrics.window.asOf)));
    assert.match(metrics.window.startsAt,/T00:00:00\.000Z$/);assert.match(metrics.window.endsAt,/T00:00:00\.000Z$/);
    assert.equal(Date.parse(metrics.window.endsAt)-Date.parse(metrics.window.startsAt),days*86400000);
    assert.equal(metrics.totalIssued,expectedQuotes);assert.equal(metrics.activeIssuers,1);assert.equal(metrics.missingIssuerCount,0);
    assert.deepEqual(metrics.time,{sampleSize:2,missingCount:1,meanMs:90000,medianMs:90000});
    assert.equal(metrics.adjustments.total,2);assert.equal(metrics.adjustments.quotesWithAdjustments,1);
    assert.equal(metrics.corrections.total,2);assert.equal(metrics.corrections.affectedQuotes,1);
    assert.deepEqual(metrics.corrections.byReason,{quantity:1,options:0,catalog:0,pricing:1,other:0});
    assert.equal(metrics.daily.length,days);assert.equal(metrics.daily.reduce((total,day)=>total+day.issued,0),3);assert.equal(metrics.daily.reduce((total,day)=>total+day.corrections,0),2);
    assert.ok(metrics.daily.every(day=>/^\d{4}-\d{2}-\d{2}$/.test(day.date)));
    for(const [day,expected] of Object.entries(manifest.pilotMetrics?.dailyIssued ?? {})) assert.equal(metrics.daily.find(item=>item.date===day)?.issued,expected);
    return metrics;
  }
  try {
    await check('synthetic-actor-email-sub-and-isolated-admin-context-guards',async()=>{
      for(const label of labels) {
        const actor=manifest.actors[label];
        const user=await cognito.send(new cs.AdminGetUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));
        const attrs=Object.fromEntries((user.UserAttributes ?? []).map(item=>[item.Name,item.Value]));
        assert.equal(attrs.email,actor.email);assert.equal(attrs.sub,actor.sub);assert.equal(attrs.email_verified,'true');assert.equal(user.Enabled,true);
        const current=(await team(actor,'GET','/context')).body;assert.equal(current.activeOrganizationId,actor.organizationId);
        assert.ok(current.memberships.some(member=>member.organizationId===actor.organizationId && member.role==='admin'));
      }
    });
    if(mode==='--browser') {
      assert.ok(manifest.pilotMetrics?.completedAt,'Verify metrics before preparing the browser fixture.');
      report.metrics=await assertMetrics(30);report.browser={actor:'owner',url:`${outputs.PublicUrl}/piloto`,declaredSyntheticDurations:true};
      manifest.pilotMetrics.browser=report.browser;await savePrivate();report.ok=true;await saveReport();console.log('Pilot metrics browser fixture retained: three real synthetic proposals, two declared incidents, and mean/p50 90 seconds.');return report;
    }
    assert.ok(!manifest.pilotMetrics?.startedAt,'Cleanup and prepare a fresh QA run before retrying a started pilot verification.');
    assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.used,0,'Pilot acceptance needs a fresh recorded QA organization.');
    assert.equal((await quote(a,'GET','/usage')).body.issuedQuotesPerMonth.used,0);
    manifest.pilotMetrics={startedAt:new Date().toISOString(),pilotA:{flowId:randomUUID(),activeDurationMs:60000,adjustments:0},pilotB:{flowId:randomUUID(),activeDurationMs:120000,adjustments:2},pricingId:randomUUID(),quantityId:randomUUID(),dailyIssued:{}};await savePrivate();
    let A;
    await check('three-issues-first-telemetry-wins-and-business-conflict-remains',async()=>{
      await catalog(owner,'POST',`/${catalogId}/publications`,document,201);
      A=(await quote(owner,'POST','',{...request,pilot:manifest.pilotMetrics.pilotA},201,`${manifest.runId}-pilot-a`)).body;
      assert.deepEqual(A.pilot,manifest.pilotMetrics.pilotA);assertAggregatePrivacy(A,secrets);
      const results=await Promise.all([1,2].map(adjustments=>quote(owner,'POST','',{...request,pilot:{flowId:randomUUID(),activeDurationMs:240000,adjustments}},200,`${manifest.runId}-pilot-a`)));
      for(const result of results) {assert.equal(result.body.quoteId,A.quoteId);assert.deepEqual(result.body.pilot,manifest.pilotMetrics.pilotA);}
      assert.equal((await quote(owner,'POST','',{...request,items:[{productId:'desk',quantity:2,optionIds:[]}]},409,`${manifest.runId}-pilot-a`)).body.error.code,'CONFLICT');
      const B=(await quote(owner,'POST','',{...request,pilot:manifest.pilotMetrics.pilotB},201,`${manifest.runId}-pilot-b`)).body;
      const C=(await quote(owner,'POST','',request,201,`${manifest.runId}-pilot-c`)).body;assert.equal(C.pilot,undefined);
      for(const item of [A,B,C]) {const day=item.issuedAt.slice(0,10);manifest.pilotMetrics.dailyIssued[day]=(manifest.pilotMetrics.dailyIssued[day] ?? 0)+1;}
      manifest.pilotMetrics.quoteIds=[A.quoteId,B.quoteId,C.quoteId];await savePrivate();
      assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.used,3);
      await quote(owner,'POST','',{...request,pilot:{...manifest.pilotMetrics.pilotA,email:'synthetic@example.invalid'}},400,`${manifest.runId}-invalid-pilot`);
    });
    await check('another-organization-is-isolated-from-the-owner-dashboard',async()=>{
      await catalog(a,'POST',`/${catalogId}/publications`,document,201);
      const foreign=(await quote(a,'POST','',request,201,`${manifest.runId}-foreign`)).body;
      await quote(a,'POST',`/${A.quoteId}/corrections`,{correctionId:randomUUID(),reason:'pricing'},404);
      await quote(owner,'POST',`/${foreign.quoteId}/corrections`,{correctionId:randomUUID(),reason:'pricing'},404);
    });
    await check('declared-corrections-deduplicate-concurrently-without-editing-snapshot-or-quota',async()=>{
      const pricing={correctionId:manifest.pilotMetrics.pricingId,reason:'pricing'};
      const results=await Promise.all([0,1].map(()=>quote(owner,'POST',`/${A.quoteId}/corrections`,pricing,[200,201])));
      assert.deepEqual(results.map(item=>item.status).sort(),[200,201]);assert.deepEqual(results[0].body,results[1].body);
      assert.equal(results[0].body.quoteId,A.quoteId);assert.equal(results[0].body.reason,'pricing');
      await quote(owner,'POST',`/${A.quoteId}/corrections`,{correctionId:manifest.pilotMetrics.quantityId,reason:'quantity'},201);
      await quote(owner,'POST',`/${A.quoteId}/corrections`,pricing,200);
      assert.equal((await quote(owner,'POST',`/${A.quoteId}/corrections`,{...pricing,reason:'options'},409)).body.error.code,'CONFLICT');
      await quote(owner,'POST',`/${A.quoteId}/corrections`,{correctionId:randomUUID(),reason:'pricing',email:'synthetic@example.invalid'},400);
      assert.deepEqual((await quote(owner,'GET',`/${A.quoteId}`)).body,A);
      assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.used,3);
    });
    await check('admin-windows-7-30-90-have-honest-sample-daily-counts-and-private-issuers',async()=>{
      report.windows={};for(const days of [7,30,90]) report.windows[days]=await assertMetrics(days);
      await quote(owner,'GET','/metrics?days=31',undefined,400);
    });
    await check('seller-and-reader-cannot-view-dashboard-reader-cannot-report-incidents',async()=>{
      const roster=(await team(owner,'GET','/members')).body.members;assert.equal(roster.length,1);assert.equal(roster[0].subject,owner.sub);
      const invitation=(await team(owner,'POST','/invitations',{email:a.email,role:'seller'},201)).body;
      manifest.pilotMetrics.invitation=invitation;await savePrivate();
      await team(a,'POST',`/invitations/${invitation.token}/accept`,{},200,owner.organizationId);
      try {
        await quote(a,'GET','/metrics?days=30',undefined,403,undefined,owner.organizationId);
        await quote(a,'POST',`/${A.quoteId}/corrections`,{correctionId:manifest.pilotMetrics.pricingId,reason:'pricing'},200,undefined,owner.organizationId);
        await team(owner,'PATCH',`/members/${a.sub}`,{role:'reader'});
        await quote(a,'GET','/metrics?days=30',undefined,403,undefined,owner.organizationId);
        await quote(a,'POST',`/${A.quoteId}/corrections`,{correctionId:randomUUID(),reason:'other'},403,undefined,owner.organizationId);
        await quote(a,'POST',`/${A.quoteId}/corrections`,{correctionId:manifest.pilotMetrics.pricingId,reason:'pricing'},403,undefined,owner.organizationId);
      } finally {await team(owner,'DELETE',`/members/${a.sub}`,undefined,204);}
      report.finalMetrics=await assertMetrics(30);assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.used,3);
    });
    manifest.pilotMetrics.completedAt=new Date().toISOString();manifest.pilotMetrics.browser={actor:'owner',url:`${outputs.PublicUrl}/piloto`,declaredSyntheticDurations:true};await savePrivate();
    report.ok=true;report.completedAt=manifest.pilotMetrics.completedAt;report.browser=manifest.pilotMetrics.browser;await saveReport();
    console.log('Pilot metrics AWS acceptance passed; report artifacts/pilot-metrics-aws.json. Synthetic fixtures do not demonstrate human savings or resolved pricing errors.');return report;
  } catch(error) {
    report.ok=false;report.failure={name:error?.name ?? 'Error',check:report.checks.at(-1)?.name ?? 'prepare'};await saveReport();throw error;
  } finally {cognito.destroy();lambda.destroy();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(`Pilot metrics AWS QA failed (${error?.name ?? 'Error'}). Review artifacts/pilot-metrics-aws.json; no credentials or invitation tokens are printed.`);process.exitCode=1;});
