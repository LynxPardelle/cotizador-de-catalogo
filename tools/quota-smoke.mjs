import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { developmentResources, assignDevelopmentPlan } from './plan-development.mjs';
import { ownOrganization } from '../services/team/domain.mjs';
import { planFor, monthlyPeriod } from '../services/shared/quota.mjs';
import { syntheticCatalog } from '../services/fixtures/catalog.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const directory=join(root,'artifacts');
const privateFile=join(directory,'quota-qa-private.json');
const reportFile=join(directory,'quota-smoke.json');
const labels=['owner','a','b'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const require=createRequire(new URL('../services/package.json',import.meta.url));
const origin='https://cotitrama-dev.lynxpardelle.com';

export function validateQuotaManifest(manifest,context) {
  assert.equal(context.region,'us-east-1');assert.equal(context.stackName,'cotitrama-development');
  assert.equal(context.outputs.PublicUrl,origin);
  assert.equal(manifest?.version,1);assert.equal(manifest.region,context.region);assert.equal(manifest.stackName,context.stackName);
  assert.equal(manifest.userPoolId,context.outputs.UserPoolId);
  assert.match(manifest.runId ?? '',/^[0-9]{8,17}-[a-f0-9]{6,12}$/);
  assert.deepEqual(Object.keys(manifest.actors ?? {}).sort(),[...labels].sort());
  for(const label of labels) {
    const actor=manifest.actors[label],email=`ct-quota-${label}-${manifest.runId}@example.invalid`;
    assert.equal(actor.email,email);
    assert.ok(actor.username===email || uuid.test(actor.username ?? ''));
    if(actor.created) assert.match(actor.sub ?? '',uuid);
    if(actor.organizationId!==undefined) {assert.match(actor.sub ?? '',uuid);assert.equal(actor.organizationId,ownOrganization(manifest.userPoolId,actor.sub));}
    if(actor.group!==undefined) assert.equal(actor.group,`org:${ownOrganization(manifest.userPoolId,actor.sub)}:admin`);
  }
  return manifest;
}
export function validateQuotaSeed(context,manifest,seed) {
  validateQuotaManifest(manifest,context);
  assert.ok(labels.includes(seed.actor));const actor=manifest.actors[seed.actor];
  assert.ok(actor.created && actor.organizationId===ownOrganization(manifest.userPoolId,actor.sub));
  assert.ok(['MembersTable','CatalogTable','QuotesTable'].includes(seed.table));
  assert.ok(context.tables[seed.table]?.startsWith(`${context.stackName}-${seed.table}-`));
  assert.equal(seed.key?.PK,`ORG#${actor.organizationId}`);
  assert.deepEqual(Object.keys(seed.key).sort(),['PK','SK']);
  if(seed.table==='MembersTable') {assert.equal(seed.key.SK,'META');assert.equal(seed.field,'memberCount');}
  if(seed.table==='CatalogTable') {assert.equal(seed.key.SK,'USAGE#CATALOGS');assert.equal(seed.field,'used');}
  if(seed.table==='QuotesTable') {assert.match(seed.key.SK,/^USAGE#\d{4}-(0[1-9]|1[0-2])$/);assert.equal(seed.field,'used');}
  return seed;
}

async function safeArtifacts() {
  assert.ok((await readFile(join(root,'.gitignore'),'utf8')).split(/\r?\n/).includes('/artifacts/'));
  await mkdir(directory,{recursive:true});assert.ok(!(await lstat(directory)).isSymbolicLink());
}
async function save(path,value,privateData=false) {
  const existing=await lstat(path).catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
  assert.ok(!existing?.isSymbolicLink());await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:privateData ? 0o600 : 0o644});
}

export async function main(args=process.argv.slice(2)) {
  assert.ok(args.length===1 && ['--prepare','--verify','--browser','--browser-limit','--cleanup'].includes(args[0]),'Use --prepare, --verify, --browser, --browser-limit, or --cleanup.');
  const mode=args[0],context=await developmentResources(),{outputs,region,tables}=context;
  for(const key of ['OnboardingFunctionName','TeamFunctionName','CatalogFunctionName','QuotesFunctionName']) assert.ok(outputs[key]?.startsWith(`${context.stackName}-`));
  await safeArtifacts();
  const cs=require('@aws-sdk/client-cognito-identity-provider'),ls=require('@aws-sdk/client-lambda');
  const {DynamoDBClient}=require('@aws-sdk/client-dynamodb'),ds=require('@aws-sdk/lib-dynamodb');
  const cognito=new cs.CognitoIdentityProviderClient({region,maxAttempts:3});
  const lambda=new ls.LambdaClient({region,maxAttempts:3});
  const database=ds.DynamoDBDocumentClient.from(new DynamoDBClient({region,maxAttempts:3}));
  let manifest;
  const previousReport=await readFile(reportFile,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
  const report={mode,startedAt:new Date().toISOString(),stackName:context.stackName,region,checks:[],billingEnabled:false,classification:{accounts:'Three admin-created synthetic users; emails suppressed.',business:'Real AWS functions invoked by IAM using HTTP API v2 envelopes; real browser JWT acceptance is separate.',higherTiers:'Guarded synthetic counter boundaries; not a load benchmark.'},syntheticBoundarySeedsForHigherTiers:false};
  const savePrivate=()=>save(privateFile,manifest,true);
  const saveReport=()=>{
    const previous=previousReport?.runId===manifest?.runId ? previousReport : undefined;
    const result={...report,...(manifest ? {runId:manifest.runId} : {}),syntheticBoundarySeedsForHigherTiers:report.syntheticBoundarySeedsForHigherTiers || previous?.syntheticBoundarySeedsForHigherTiers || false,updatedAt:new Date().toISOString()};
    // Preserve acceptance evidence when browser preparation and cleanup run later.
    result.runs=[...(previous?.runs ?? []).filter(run=>run.mode!==mode),{...report}];
    return save(reportFile,result);
  };
  async function progress(phase,completed,target) {
    report.progress={phase,completed,target};await saveReport();console.log(`Quota QA ${phase}: ${completed}/${target} real proposals.`);
  }
  async function check(name,operation) {
    const entry={name,ok:false};report.checks.push(entry);
    try {const result=await operation();entry.ok=true;await saveReport();return result;}
    catch(error) {entry.errorType=error?.name ?? 'Error';await saveReport();throw error;}
  }
  async function invoke(name,event) {
    const result=await lambda.send(new ls.InvokeCommand({FunctionName:name,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify(event))}));
    assert.ok(!result.FunctionError && result.Payload,'AWS function failed.');return JSON.parse(Buffer.from(result.Payload).toString('utf8'));
  }
  const envelope=(actor,method,path,body,key,org=actor.organizationId)=>({version:'2.0',rawPath:`/api/v1${path}`,headers:{'x-organization-id':org,...(key ? {'idempotency-key':key} : {})},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{requestId:`quota-qa-${randomUUID()}`,http:{method},authorizer:{jwt:{claims:{sub:actor.sub,token_use:'access','cognito:groups':[actor.group]}}}}});
  async function call(fn,actor,method,path,body,expected=200,key,org) {
    const result=await invoke(fn,envelope(actor,method,path,body,key,org));
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(result.statusCode),'Unexpected quota HTTP result.');
    return {status:result.statusCode,body:result.body ? JSON.parse(result.body) : undefined};
  }
  const team=(actor,method,path,body,status=200,org)=>call(outputs.TeamFunctionName,actor,method,`/team${path}`,body,status,undefined,org);
  const catalog=(actor,method,path,body,status=200)=>call(outputs.CatalogFunctionName,actor,method,`/catalogs${path}`,body,status);
  const quote=(actor,method,path,body,status=200,key)=>call(outputs.QuotesFunctionName,actor,method,`/quotes${path}`,body,status,key);
  const qaCatalog=id=>({...structuredClone(syntheticCatalog),catalogId:id,name:'Catálogo sintético de cuotas'});
  const request=id=>({catalogId:id,version:1,currency:'MXN',items:[{productId:'desk',quantity:1,optionIds:[]}]});
  const id=suffix=>`quota-${manifest.runId}-${suffix}`;
  const get=async(table,key)=>(await database.send(new ds.GetCommand({TableName:tables[table],Key:key,ConsistentRead:true}))).Item;
  async function records(table,org,prefix) {
    const rows=[];let ExclusiveStartKey;
    do {const page=await database.send(new ds.QueryCommand({TableName:tables[table],KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':`ORG#${org}`,':prefix':prefix},ConsistentRead:true,ExclusiveStartKey}));rows.push(...(page.Items ?? []));ExclusiveStartKey=page.LastEvaluatedKey;} while(ExclusiveStartKey);
    return rows;
  }
  async function verifyActor(actor) {
    const result=await cognito.send(new cs.AdminGetUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));
    const attrs=Object.fromEntries((result.UserAttributes ?? []).map(a=>[a.Name,a.Value]));
    assert.equal(attrs.email,actor.email);assert.equal(attrs.sub,actor.sub);assert.equal(actor.organizationId,ownOrganization(outputs.UserPoolId,attrs.sub));
    return result;
  }
  async function ownedCounter(seed) {
    validateQuotaSeed(context,manifest,seed);const actor=manifest.actors[seed.actor];await verifyActor(actor);
    const owner=await get('MembersTable',{PK:`USER#${actor.sub}`,SK:`ORG#${actor.organizationId}`});
    assert.equal(owner?.member?.subject,actor.sub);assert.equal(owner.member.role,'admin');assert.equal(owner.member.email,actor.email);
    const item=await get(seed.table,seed.key);assert.ok(item && Number.isSafeInteger(item[seed.field]) && item[seed.field]>=0);
    return item[seed.field];
  }
  async function restore(seed) {
    const before=await ownedCounter(seed),actor=manifest.actors[seed.actor];let used;
    if(seed.table==='MembersTable') {
      const members=await records(seed.table,actor.organizationId,'MEMBER#');
      assert.ok(members.every(row=>labels.some(label=>manifest.actors[label].sub===row.member?.subject && manifest.actors[label].email===row.member.email)));
      used=members.length;
    } else if(seed.table==='CatalogTable') {
      const versions=await records(seed.table,actor.organizationId,'CATALOG#'),heads=await records(seed.table,actor.organizationId,'HEAD#');
      const archived=new Set(heads.filter(head=>head.active===false).map(head=>head.catalogId));
      used=new Set(versions.filter(row=>row.catalog && !archived.has(row.catalog.catalogId)).map(row=>row.catalog.catalogId)).size;
    } else {
      const period=monthlyPeriod(new Date(`${seed.key.SK.slice(6)}-01T00:00:00.000Z`));
      const rows=await records(seed.table,actor.organizationId,'QUOTE#');
      used=rows.filter(row=>row.quote?.issuedAt>=period.startsAt && row.quote?.issuedAt<period.resetsAt).length;
    }
    await database.send(new ds.UpdateCommand({TableName:tables[seed.table],Key:seed.key,UpdateExpression:'SET #value = :value',ConditionExpression:'attribute_exists(PK) AND #value = :before',ExpressionAttributeNames:{'#value':seed.field},ExpressionAttributeValues:{':value':used,':before':before}}));
  }
  async function restorePending() {
    for(const seed of [...(manifest?.pendingSeeds ?? [])]) {
      await restore(seed);manifest.pendingSeeds=manifest.pendingSeeds.filter(item=>JSON.stringify(item)!==JSON.stringify(seed));await savePrivate();
    }
  }
  async function seedCounter(actorLabel,table,SK,field,value) {
    assert.ok(Number.isSafeInteger(value) && value>=0);
    const seed={actor:actorLabel,table,key:{PK:`ORG#${manifest.actors[actorLabel].organizationId}`,SK},field};
    const before=await ownedCounter(seed);
    if(!(manifest.pendingSeeds ?? []).some(item=>JSON.stringify(item)===JSON.stringify(seed))) {manifest.pendingSeeds ??=[];manifest.pendingSeeds.push(seed);await savePrivate();}
    await database.send(new ds.UpdateCommand({TableName:tables[table],Key:seed.key,UpdateExpression:'SET #value = :value',ConditionExpression:'attribute_exists(PK) AND #value = :before',ExpressionAttributeNames:{'#value':field},ExpressionAttributeValues:{':value':value,':before':before}}));
  }
  async function cleanJoinedMembers() {
    const owner=manifest.actors.owner,roster=(await team(owner,'GET','/members')).body.members;
    assert.ok(roster.every(member=>labels.some(label=>manifest.actors[label].sub===member.subject)),'Unrelated membership blocks the QA mutation.');
    for(const member of roster) if(member.subject!==owner.sub) await team(owner,'DELETE',`/members/${member.subject}`,undefined,204);
  }
  async function memberRace(tag) {
    const {owner,a,b}=manifest.actors;const recipients=[a,b],invitations=[];
    for(const actor of recipients) invitations.push((await team(owner,'POST','/invitations',{email:actor.email,role:'seller'},201)).body);
    manifest.invitations={tag,values:invitations};await savePrivate();
    const accepted=await Promise.all(recipients.map((actor,i)=>team(actor,'POST',`/invitations/${invitations[i].token}/accept`,{},[200,409],owner.organizationId)));
    assert.deepEqual(accepted.map(item=>item.status).sort(),[200,409]);
    const winner=accepted.findIndex(item=>item.status===200),loser=1-winner;
    assert.equal(accepted[loser].body.error.code,'PLAN_LIMIT_REACHED');
    await team(recipients[winner],'POST',`/invitations/${invitations[winner].token}/accept`,{},200,owner.organizationId);
    await team(owner,'DELETE',`/members/${recipients[winner].sub}`,undefined,204);
    await team(recipients[winner],'POST',`/invitations/${invitations[winner].token}/accept`,{},409,owner.organizationId);
    await team(recipients[loser],'POST',`/invitations/${invitations[loser].token}/accept`,{},200,owner.organizationId);
  }
  try {
    const text=await readFile(privateFile,'utf8').catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
    if(text) manifest=validateQuotaManifest(JSON.parse(text),context);
    if(mode==='--cleanup') {
      assert.ok(manifest,'No recorded quota QA manifest to clean up.');await restorePending();
      await check('cleanup-only-three-recorded-synthetic-users-and-empty-owned-groups',async()=>{
        for(const label of labels) {
          const actor=manifest.actors[label];if(!actor.created) continue;
          if(!actor.deleted) {
            try {await verifyActor(actor);await cognito.send(new cs.AdminDeleteUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));}
            catch(error) {if(error.name!=='UserNotFoundException') throw error;}
            actor.deleted=true;await savePrivate();
          }
          if(actor.group && !actor.groupDeleted) {
            try {const roster=await cognito.send(new cs.ListUsersInGroupCommand({UserPoolId:outputs.UserPoolId,GroupName:actor.group,Limit:60}));assert.ok(!roster.NextToken && !(roster.Users ?? []).length);await cognito.send(new cs.DeleteGroupCommand({UserPoolId:outputs.UserPoolId,GroupName:actor.group}));}
            catch(error) {if(error.name!=='ResourceNotFoundException') throw error;}
            actor.groupDeleted=true;await savePrivate();
          }
        }
      });
      report.cleanup={privateCredentialsRemoved:true,syntheticDynamoDbEvidenceRetained:true};report.ok=true;await saveReport();await unlink(privateFile);
      console.log('Quota QA accounts cleaned; synthetic DynamoDB evidence retained.');return report;
    }
    if(!manifest) {
      assert.equal(mode,'--prepare','Prepare a new synthetic QA run first.');
      const runId=`${Date.now()}-${randomBytes(3).toString('hex')}`;
      manifest={version:1,runId,createdAt:new Date().toISOString(),region,stackName:context.stackName,userPoolId:outputs.UserPoolId,publicUrl:origin,pendingSeeds:[],actors:Object.fromEntries(labels.map(label=>{
        const email=`ct-quota-${label}-${runId}@example.invalid`;return [label,{email,username:email,password:`Ct1!${randomBytes(24).toString('base64url')}`,created:false}];
      }))};await savePrivate();
    }
    assert.ok(!labels.some(label=>manifest.actors[label].deleted));
    if(mode==='--prepare') {
      await check('prepare-three-isolated-synthetic-accounts-with-suppressed-email',async()=>{
        for(const label of labels) {
          const actor=manifest.actors[label];
          if(!actor.created) {
            const result=await cognito.send(new cs.AdminCreateUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.email,MessageAction:'SUPPRESS',TemporaryPassword:actor.password,UserAttributes:[{Name:'email',Value:actor.email},{Name:'email_verified',Value:'true'}]}));
            actor.username=result.User?.Username ?? actor.email;actor.sub=result.User?.Attributes?.find(item=>item.Name==='sub')?.Value;assert.match(actor.sub ?? '',uuid);actor.created=true;await savePrivate();
          }
          if(!actor.passwordSet) {await cognito.send(new cs.AdminSetUserPasswordCommand({UserPoolId:outputs.UserPoolId,Username:actor.username,Password:actor.password,Permanent:true}));actor.passwordSet=true;await savePrivate();}
          actor.organizationId=ownOrganization(outputs.UserPoolId,actor.sub);actor.group=`org:${actor.organizationId}:admin`;await savePrivate();
          if(!actor.onboarded) {
            const input={version:'1',triggerSource:'PostConfirmation_ConfirmSignUp',region,userPoolId:outputs.UserPoolId,userName:actor.username,request:{userAttributes:{sub:actor.sub,email:actor.email,email_verified:'true'}},response:{}};
            await invoke(outputs.OnboardingFunctionName,input);await invoke(outputs.OnboardingFunctionName,input);
            const groups=await cognito.send(new cs.AdminListGroupsForUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));
            assert.ok(!groups.NextToken);assert.deepEqual(groups.Groups.map(group=>group.GroupName),[actor.group]);
            const own=(await team(actor,'GET','/context')).body;assert.equal(own.activeOrganizationId,actor.organizationId);assert.equal(own.plan.id,'esencial');actor.onboarded=true;await savePrivate();
          }
        }
        assert.equal(new Set(labels.map(label=>manifest.actors[label].organizationId)).size,3);validateQuotaManifest(manifest,context);
      });
      report.ok=true;report.preparedForBrowser=true;report.privateCredentialsPath='artifacts/quota-qa-private.json';await saveReport();console.log('Quota QA prepared; credentials remain in the ignored private artifact.');return report;
    }
    assert.ok(labels.every(label=>manifest.actors[label].created && manifest.actors[label].onboarded));await restorePending();
    if(mode==='--browser' || mode==='--browser-limit') {
      const actor=manifest.actors.b,target=mode==='--browser' ? 80 : 100,catalogId=id('browser');
      await check(`browser-fixture-${target}-real-issues-without-counter-seeds`,async()=>{
        await assignDevelopmentPlan(context,actor.organizationId,'esencial');
        const roster=(await team(actor,'GET','/members')).body.members;assert.equal(roster.length,1);assert.equal(roster[0].subject,actor.sub);
        await catalog(actor,'POST',`/${catalogId}/publications`,qaCatalog(catalogId),[200,201]);
        for(let i=1;i<=target;i++) {await quote(actor,'POST','',request(catalogId),[200,201],`${manifest.runId}-browser-${i}`);if(i%20===0) await progress('browser',i,target);}
        const usage=(await quote(actor,'GET','/usage')).body.issuedQuotesPerMonth;assert.equal(usage.used,target);assert.equal(usage.state,target===80 ? 'warning' : 'limit');
        assert.equal((await catalog(actor,'GET','/usage')).body.activeCatalogs.used,1);
        manifest.browser={actor:'b',url:`${origin}/consumo`,catalogId,expectedUsed:target,seeded:false};await savePrivate();
        report.browser={actor:'b',url:`${origin}/consumo`,expectedUsed:target,realIssuedQuotes:true,syntheticBoundarySeed:false};
      });
      report.ok=true;await saveReport();console.log(`Quota browser fixture ready at ${target} real proposals. See the private artifact for the recorded account.`);return report;
    }
    assert.equal(mode,'--verify');assert.ok(!manifest.verificationStartedAt,'This verification already started. Cleanup and prepare a fresh run before retrying.');
    manifest.verificationStartedAt=new Date().toISOString();await savePrivate();
    const owner=manifest.actors.owner,c1=id('one'),c2=id('two'),c3=id('three');
    await assignDevelopmentPlan(context,owner.organizationId,'esencial');
    await check('esencial-catalog-ids-versus-revisions-archive-reactivate-and-replay',async()=>{
      await catalog(owner,'POST',`/${c1}/publications`,qaCatalog(c1),201);
      await catalog(owner,'POST',`/${c1}/publications`,{...qaCatalog(c1),version:2},201);
      assert.equal((await catalog(owner,'GET','/usage')).body.activeCatalogs.used,1);
      await catalog(owner,'POST',`/${c2}/publications`,qaCatalog(c2),201);
      assert.equal((await catalog(owner,'POST',`/${c3}/publications`,qaCatalog(c3),409)).body.error.code,'PLAN_LIMIT_REACHED');
      for(let i=0;i<2;i++) await catalog(owner,'PATCH',`/${c2}/status`,{active:false});
      assert.equal((await catalog(owner,'GET','/usage')).body.activeCatalogs.used,1);
      await catalog(owner,'POST',`/${c3}/publications`,qaCatalog(c3),201);
      await catalog(owner,'PATCH',`/${c2}/status`,{active:true},409);
      await catalog(owner,'PATCH',`/${c3}/status`,{active:false});
      for(let i=0;i<2;i++) await catalog(owner,'PATCH',`/${c2}/status`,{active:true});
      assert.equal((await catalog(owner,'GET','/usage')).body.activeCatalogs.used,2);
      await catalog(owner,'PATCH',`/${c2}/status`,{active:false});
    });
    let lastQuote;
    await check('esencial-100-real-issues-80-warning-100-limit-and-101-blocked',async()=>{
      for(let i=1;i<=100;i++) {
        lastQuote=(await quote(owner,'POST','',request(c1),201,`${manifest.runId}-esencial-${i}`)).body;
        if(i%20===0) await progress('esencial',i,100);
        if(i===80 || i===100) {const metric=(await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth;assert.equal(metric.used,i);assert.equal(metric.state,i===80 ? 'warning' : 'limit');}
      }
      const refused=await quote(owner,'POST','',request(c1),409,`${manifest.runId}-esencial-101`);assert.equal(refused.body.error.code,'PLAN_LIMIT_REACHED');
      const replay=await quote(owner,'POST','',request(c1),200,`${manifest.runId}-esencial-100`);assert.equal(replay.body.quoteId,lastQuote.quoteId);
      assert.equal((await quote(owner,'POST','',{...request(c1),items:[{productId:'desk',quantity:2,optionIds:[]}]},409,`${manifest.runId}-esencial-100`)).body.error.code,'CONFLICT');
      await quote(owner,'POST','/preview',request(c1));await quote(owner,'GET',`/${lastQuote.quoteId}`);
      assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.used,100);
      report.esencialRealIssuedQuotes=100;
    });
    await check('esencial-concurrent-last-seat-replay-removal-and-no-resurrection',async()=>{await memberRace('esencial');await cleanJoinedMembers();});
    for(const planId of ['equipo','empresa']) {
      const plan=planFor(planId);await assignDevelopmentPlan(context,owner.organizationId,planId);
      report.syntheticBoundarySeedsForHigherTiers=true;
      try {
        await check(`${planId}-quote-warning-and-last-slot-real-transactions-with-synthetic-boundary`,async()=>{
          const period=(await quote(owner,'GET','/usage')).body.period;assert.equal(period.key,monthlyPeriod().key);
          await seedCounter('owner','QuotesTable',`USAGE#${period.key}`,'used',Math.ceil(plan.limits.issuedQuotesPerMonth*.8)-1);
          await quote(owner,'POST','',request(c1),201,`${manifest.runId}-${planId}-warning`);
          assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.state,'warning');
          await seedCounter('owner','QuotesTable',`USAGE#${period.key}`,'used',plan.limits.issuedQuotesPerMonth-1);
          const keys=[0,1].map(i=>`${manifest.runId}-${planId}-race-${i}`);
          const outcomes=await Promise.all(keys.map(key=>quote(owner,'POST','',request(c1),[201,409],key)));
          assert.deepEqual(outcomes.map(result=>result.status).sort(),[201,409]);const winner=outcomes.findIndex(result=>result.status===201);
          assert.equal(outcomes[1-winner].body.error.code,'PLAN_LIMIT_REACHED');
          const replay=await quote(owner,'POST','',request(c1),200,keys[winner]);assert.equal(replay.body.quoteId,outcomes[winner].body.quoteId);
          assert.equal((await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth.used,plan.limits.issuedQuotesPerMonth);
        });
        await check(`${planId}-catalog-last-slot-race-and-existing-revision-is-free`,async()=>{
          await catalog(owner,'GET','/usage');await seedCounter('owner','CatalogTable','USAGE#CATALOGS','used',plan.limits.activeCatalogs-1);
          const names=[id(`${planId}-a`),id(`${planId}-b`)];
          const outcomes=await Promise.all(names.map(name=>catalog(owner,'POST',`/${name}/publications`,qaCatalog(name),[201,409])));
          assert.deepEqual(outcomes.map(result=>result.status).sort(),[201,409]);const winner=outcomes.findIndex(result=>result.status===201);
          assert.equal(outcomes[1-winner].body.error.code,'PLAN_LIMIT_REACHED');
          await catalog(owner,'POST',`/${names[winner]}/publications`,{...qaCatalog(names[winner]),version:2},201);
          assert.equal((await catalog(owner,'GET','/usage')).body.activeCatalogs.used,plan.limits.activeCatalogs);
        });
        await check(`${planId}-member-last-slot-race-with-synthetic-boundary`,async()=>{
          await team(owner,'GET','/usage');await seedCounter('owner','MembersTable','META','memberCount',plan.limits.members-1);await memberRace(planId);
          assert.equal((await team(owner,'GET','/usage')).body.members.used,plan.limits.members);
        });
      } finally {await restorePending();await cleanJoinedMembers();}
    }
    await check('downgrade-overage-preserves-existing-snapshots-and-blocks-new-issues',async()=>{
      await assignDevelopmentPlan(context,owner.organizationId,'esencial');
      const usage=(await quote(owner,'GET','/usage')).body.issuedQuotesPerMonth;assert.ok(usage.used>100);assert.equal(usage.state,'over');
      assert.equal((await catalog(owner,'GET','/usage')).body.activeCatalogs.state,'over');
      assert.equal((await catalog(owner,'POST',`/${id('downgrade')}/publications`,qaCatalog(id('downgrade')),409)).body.error.code,'PLAN_LIMIT_REACHED');
      assert.deepEqual((await quote(owner,'GET',`/${lastQuote.quoteId}`)).body,lastQuote);
      await quote(owner,'POST','/preview',request(c1));assert.equal((await quote(owner,'POST','',request(c1),409,`${manifest.runId}-downgrade`)).body.error.code,'PLAN_LIMIT_REACHED');
    });
    manifest.verificationCompletedAt=new Date().toISOString();await savePrivate();report.ok=true;report.completedAt=manifest.verificationCompletedAt;report.counterSeedsRestored=true;await saveReport();
    console.log('Quota AWS acceptance passed. Report: artifacts/quota-smoke.json; higher tiers used disclosed synthetic boundary seeds.');return report;
  } catch(error) {
    report.ok=false;report.failure={name:error?.name ?? 'Error',check:report.checks.at(-1)?.name ?? 'prepare'};await saveReport();throw error;
  } finally {
    try {if(manifest?.pendingSeeds?.length) {await restorePending();report.counterSeedsRestored=true;await saveReport();}}
    finally {cognito.destroy();lambda.destroy();database.destroy();}
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(`Quota AWS QA failed (${error?.name ?? 'Error'}). Review artifacts/quota-smoke.json; credentials and invite tokens are never printed.`);process.exitCode=1;});
