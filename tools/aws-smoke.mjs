import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { syntheticCatalog } from '../services/fixtures/catalog.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const artifacts=join(root,'artifacts');
const privatePath=join(artifacts,'aws-qa-private.json');
const reportPath=join(artifacts,'aws-smoke.json');
const stackName='cotitrama-development';
const region='us-east-1';
const origin='https://cotitrama-dev.lynxpardelle.com';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const require=createRequire(new URL('../services/package.json',import.meta.url));
const execute=promisify(execFile);
const organization=(pool,sub)=>`org-${createHash('sha256').update(`${pool}:${sub.toLowerCase()}`).digest('hex').slice(0,32)}`;

export function validateDevelopmentStack(config,stack) {
  const dev=config?.environments?.development;
  assert.equal(config?.region,region,'Only us-east-1 is allowed.');
  assert.equal(dev?.stackName,stackName,'Only the development stack is allowed.');
  assert.equal(dev?.branch,'development','Development configuration is required.');
  assert.equal(`https://${dev?.domain}`,origin,'The development hostname must be exact.');
  assert.equal(stack?.StackName,stackName,'The described stack is not development.');
  const account=/^arn:aws:acm:us-east-1:(\d{12}):certificate\//.exec(config?.parameters?.CertificateArn ?? '')?.[1];
  assert.ok(account,'The configured certificate account must be known.');
  assert.ok(stack?.StackId?.startsWith(`arn:aws:cloudformation:${region}:${account}:stack/${stackName}/`),'The AWS account, region or stack differs.');
  const outputs=Object.fromEntries((stack.Outputs ?? []).map(item=>[item.OutputKey,item.OutputValue]));
  assert.equal(outputs.PublicUrl,origin,'The stack public origin is not development.');
  assert.match(outputs.UserPoolId ?? '',/^us-east-1_[a-zA-Z0-9]+$/,'The user pool is invalid.');
  return outputs;
}

export function validateQaManifest(manifest,outputs) {
  assert.equal(manifest?.version,1,'Unsupported QA manifest.');
  assert.equal(manifest?.stackName,stackName,'QA manifest is not development.');
  assert.equal(manifest?.region,region,'QA manifest is not us-east-1.');
  assert.equal(manifest?.userPoolId,outputs.UserPoolId,'QA manifest belongs to another user pool.');
  if(manifest.userPoolClientId!==undefined) assert.equal(manifest.userPoolClientId,outputs.UserPoolClientId,'QA manifest belongs to another client.');
  if(manifest.publicUrl!==undefined) assert.equal(manifest.publicUrl,origin,'QA manifest has another public origin.');
  assert.match(manifest?.runId ?? '',/^[0-9]{8,17}-[a-f0-9]{6,12}$/,'QA run identifier is invalid.');
  assert.deepEqual(Object.keys(manifest.actors ?? {}).sort(),['other','owner'],'Exactly the two synthetic actors are required.');
  for(const label of ['owner','other']) {
    const actor=manifest.actors[label];
    const email=`ct-qa-${label}-${manifest.runId}@example.invalid`;
    assert.equal(actor.email,email,'A QA email is outside the synthetic namespace.');
    assert.ok(actor.username===email || uuid.test(actor.username ?? ''),'The QA username is outside the synthetic namespace.');
    if(actor.created) assert.match(actor.sub ?? '',uuid,'The created QA user needs its recorded sub.');
    if(actor.group!==undefined) {
      assert.match(actor.sub ?? '',uuid,'A group needs its confirmed QA sub.');
      assert.equal(actor.group,`org:${organization(outputs.UserPoolId,actor.sub)}:admin`,'The QA group is unrelated to this user.');
    }
  }
  return manifest;
}

async function prepareArtifactDirectory() {
  const ignore=await readFile(join(root,'.gitignore'),'utf8');
  assert.ok(ignore.split(/\r?\n/).includes('/artifacts/'),'Artifacts must be ignored before writing QA credentials.');
  await mkdir(artifacts,{recursive:true});
  assert.ok(!(await lstat(artifacts)).isSymbolicLink(),'Artifacts cannot be a symlink.');
}
async function writeJson(path,value,privateFile=false) {
  const existing=await lstat(path).catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
  assert.ok(!existing?.isSymbolicLink(),'Artifact files cannot be symlinks.');
  if(privateFile) {
    // Credentials have exactly one allowed path; never leave credential temp files.
    await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'w'});
    return;
  }
  const temporary=`${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o644,flag:'wx'});
  await rename(temporary,path);
}
async function awsJson(command,args=[]) {
  const executable=process.platform==='win32' ? 'aws.exe' : 'aws';
  const {stdout}=await execute(executable,[...command,...args,'--region',region,'--output','json','--no-cli-pager'],{cwd:root,windowsHide:true,maxBuffer:4*1024*1024});
  return JSON.parse(stdout);
}
function safeResult(manifest) {
  return Object.fromEntries(Object.entries(manifest.actors).map(([label,actor])=>[label,{username:actor.username,sub:actor.sub,organizationId:actor.organizationId,group:actor.group,deleted:actor.deleted ?? false}]));
}

export async function main(args=process.argv.slice(2)) {
  assert.ok(args.length<=1 && (!args.length || ['--prepare','--verify','--cleanup'].includes(args[0])),'Use --prepare, --verify, or --cleanup.');
  const mode=args[0] ?? '--verify';
  const config=JSON.parse(await readFile(join(root,'infra','environments.json'),'utf8'));
  assert.equal(config?.environments?.development?.stackName,stackName,'Stack guard failed.');
  assert.equal(config?.region,region,'Region guard failed.');
  const response=await awsJson(['cloudformation','describe-stacks'],['--stack-name',stackName]);
  const outputs=validateDevelopmentStack(config,response.Stacks?.[0]);
  const needed=['CatalogFunctionName','QuotesFunctionName','OnboardingFunctionName','TeamFunctionName','UserPoolClientId'];
  for(const key of needed) assert.ok(typeof outputs[key]==='string' && outputs[key],'Deploy the current development template before QA.');
  for(const key of needed.filter(key=>key.endsWith('FunctionName'))) assert.ok(outputs[key].startsWith(`${stackName}-`),'Function ownership guard failed.');
  await prepareArtifactDirectory();

  const cognitoSdk=require('@aws-sdk/client-cognito-identity-provider');
  const lambdaSdk=require('@aws-sdk/client-lambda');
  const cognito=new cognitoSdk.CognitoIdentityProviderClient({region,maxAttempts:3});
  const lambda=new lambdaSdk.LambdaClient({region,maxAttempts:3});
  const report={startedAt:new Date().toISOString(),stackName,region,publicUrl:origin,mode,classification:{accounts:'Admin-created synthetic QA; emails suppressed.',business:'IAM Lambda invocation using HTTP API v2 event contract.',roleChecks:'Real Team database membership changes; stale legacy claims cannot override current roles.',jwtGateway:'Not authenticated by this script. Browser QA must test real Hosted UI tokens.'},checks:[]};
  let manifest;
  const savePrivate=()=>writeJson(privatePath,manifest,true);
  const saveReport=()=>writeJson(reportPath,{...report,...(manifest ? {runId:manifest.runId,actors:safeResult(manifest)} : {}),updatedAt:new Date().toISOString()});
  async function check(name,operation) {
    const entry={name,ok:false};report.checks.push(entry);
    try {const result=await operation();entry.ok=true;await saveReport();return result;}
    catch(error) {entry.errorType=error?.name ?? 'Error';await saveReport();throw error;}
  }
  const invoke=async(name,event)=>{
    const result=await lambda.send(new lambdaSdk.InvokeCommand({FunctionName:name,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify(event))}));
    assert.ok(!result.FunctionError && result.Payload,'Lambda invocation failed.');
    return JSON.parse(Buffer.from(result.Payload).toString('utf8'));
  };
  const groupsFor=async(username)=>{
    const names=[];let NextToken;
    do {const result=await cognito.send(new cognitoSdk.AdminListGroupsForUserCommand({UserPoolId:outputs.UserPoolId,Username:username,Limit:60,NextToken}));names.push(...(result.Groups ?? []).map(group=>group.GroupName));NextToken=result.NextToken;} while(NextToken);
    return names;
  };

  try {
    const text=await readFile(privatePath,'utf8').catch(error=>{if(error.code==='ENOENT') return undefined;throw error;});
    if(text) manifest=validateQaManifest(JSON.parse(text),outputs);
    if(mode==='--cleanup') {
      assert.ok(manifest,'No recorded QA accounts exist to clean up.');
      await check('cleanup-only-recorded-qa-users-and-empty-groups',async()=>{
        for(const label of ['owner','other']) {
          const actor=manifest.actors[label];
          if(!actor.created) continue;
          if(!actor.deleted) {
            let user;
            try {user=await cognito.send(new cognitoSdk.AdminGetUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));}
            catch(error) {if(error.name!=='UserNotFoundException') throw error;}
            if(user) {
              const attributes=Object.fromEntries((user.UserAttributes ?? []).map(item=>[item.Name,item.Value]));
              assert.equal(attributes.email,`ct-qa-${label}-${manifest.runId}@example.invalid`,'Cleanup email ownership guard failed.');
              assert.equal(attributes.sub,actor.sub,'Cleanup sub ownership guard failed.');
              await cognito.send(new cognitoSdk.AdminDeleteUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));
            }
            actor.deleted=true;await savePrivate();
          }
          if(actor.group && !actor.groupDeleted) {
            try {
              const members=await cognito.send(new cognitoSdk.ListUsersInGroupCommand({UserPoolId:outputs.UserPoolId,GroupName:actor.group,Limit:60}));
              assert.ok(!members.NextToken && (members.Users ?? []).length===0,'An unrelated membership prevents deleting this QA group.');
              await cognito.send(new cognitoSdk.DeleteGroupCommand({UserPoolId:outputs.UserPoolId,GroupName:actor.group}));
            } catch(error) {if(error.name!=='ResourceNotFoundException') throw error;}
            actor.groupDeleted=true;await savePrivate();
          }
        }
      });
      report.cleanup={privateCredentialsRemoved:true,syntheticDynamoDbRecordsRetained:true};
      await saveReport();await unlink(privatePath);
      console.log('CotiTrama development QA accounts cleaned. Synthetic DynamoDB evidence retained.');
      return report;
    }

    if(!manifest) {
      const runId=`${Date.now()}-${randomBytes(3).toString('hex')}`;
      manifest={version:1,runId,createdAt:new Date().toISOString(),stackName,region,userPoolId:outputs.UserPoolId,userPoolClientId:outputs.UserPoolClientId,publicUrl:origin,catalogId:`qa-${runId}`,actors:Object.fromEntries(['owner','other'].map(label=>{
        const email=`ct-qa-${label}-${runId}@example.invalid`;
        return [label,{email,username:email,password:`Ct1!${randomBytes(24).toString('base64url')}`,created:false}];
      }))};
      validateQaManifest(manifest,outputs);await savePrivate();
    }
    assert.ok(!Object.values(manifest.actors).some(actor=>actor.deleted),'Clean up the previous QA run before preparing another.');

    await check('prepare-two-suppressed-synthetic-accounts',async()=>{
      for(const label of ['owner','other']) {
        const actor=manifest.actors[label];
        if(!actor.created) {
          const created=await cognito.send(new cognitoSdk.AdminCreateUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.email,MessageAction:'SUPPRESS',TemporaryPassword:actor.password,UserAttributes:[{Name:'email',Value:actor.email},{Name:'email_verified',Value:'true'}]}));
          actor.username=created.User?.Username ?? actor.email;
          actor.sub=created.User?.Attributes?.find(attribute=>attribute.Name==='sub')?.Value;
          if(!actor.sub) {
            const user=await cognito.send(new cognitoSdk.AdminGetUserCommand({UserPoolId:outputs.UserPoolId,Username:actor.username}));
            actor.sub=user.UserAttributes?.find(attribute=>attribute.Name==='sub')?.Value;
          }
          assert.match(actor.sub ?? '',uuid,'The created user has no valid sub.');
          actor.created=true;await savePrivate();
        }
        if(!actor.passwordSet) {
          await cognito.send(new cognitoSdk.AdminSetUserPasswordCommand({UserPoolId:outputs.UserPoolId,Username:actor.username,Password:actor.password,Permanent:true}));
          actor.passwordSet=true;await savePrivate();
        }
      }
    });
    await check('onboarding-retries-one-group-per-user-distinct-organizations',async()=>{
      for(const actor of Object.values(manifest.actors)) {
        const event={version:'1',triggerSource:'PostConfirmation_ConfirmSignUp',region,userPoolId:outputs.UserPoolId,userName:actor.username,request:{userAttributes:{sub:actor.sub,email:actor.email,email_verified:'true'},clientMetadata:{organizationId:'ignored-untrusted-value'}},response:{}};
        await invoke(outputs.OnboardingFunctionName,event);await invoke(outputs.OnboardingFunctionName,event);
        const names=await groupsFor(actor.username);
        const expected=`org:${organization(outputs.UserPoolId,actor.sub)}:admin`;
        assert.deepEqual(names,[expected],'Onboarding did not create exactly the isolated admin membership.');
        actor.group=expected;actor.organizationId=expected.split(':')[1];await savePrivate();
      }
      assert.notEqual(manifest.actors.owner.organizationId,manifest.actors.other.organizationId,'QA actors must not share an organization.');
    });
    report.preparedForBrowser=true;report.privateCredentialsPath='artifacts/aws-qa-private.json';
    if(mode==='--prepare') {await saveReport();console.log('CotiTrama development QA prepared. Credentials are in the ignored private artifact.');return report;}

    const {owner,other}=manifest.actors;
    const event=(actor,method,path,body,key,organizationId=actor.organizationId)=>({version:'2.0',rawPath:`/api/v1${path}`,headers:{...(key ? {'idempotency-key':key} : {}),...(organizationId ? {'x-organization-id':organizationId} : {})},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{requestId:`aws-qa-${randomUUID()}`,http:{method},authorizer:{jwt:{claims:{sub:actor.sub,token_use:'access','cognito:groups':[actor.group]}}}}});
    const call=async(name,input,status)=>{const result=await invoke(name,input);assert.equal(result.statusCode,status,'Unexpected business HTTP contract status.');return result.body ? JSON.parse(result.body) : undefined;};
    const team=(actor,method,path,body,status=200,organizationId=actor.organizationId)=>call(outputs.TeamFunctionName,event(actor,method,`/team${path}`,body,undefined,organizationId),status);
    const catalog={...structuredClone(syntheticCatalog),catalogId:manifest.catalogId,name:'Catálogo sintético QA AWS'};
    const request={catalogId:catalog.catalogId,version:1,currency:'MXN',items:[{productId:'desk',quantity:5,optionIds:['oak','assembly']}]};
    let issued;
    await check('recover-only-recorded-qa-owner-role-and-repeated-run-membership',async()=>{
      const ownerContext=await team(owner,'GET','/context');
      const ownerMember=ownerContext.memberships.find(member=>member.organizationId===owner.organizationId);
      assert.ok(ownerMember,'The QA owner no longer has its original workspace.');
      if(ownerMember.role!=='admin') {
        const otherContext=await team(other,'GET','/context',undefined,200,owner.organizationId);
        assert.ok(otherContext.memberships.some(member=>member.organizationId===owner.organizationId && member.role==='admin'),'No recorded QA administrator can safely restore this run.');
        await team(other,'PATCH',`/members/${owner.sub}`,{role:'admin'},200,owner.organizationId);
      }
      const roster=await team(owner,'GET','/members');
      assert.ok(roster.members.every(member=>[owner.sub,other.sub].includes(member.subject)),'Unrelated users in this QA workspace require manual review before a destructive membership test.');
      if(roster.members.some(member=>member.subject===other.sub)) await team(owner,'DELETE',`/members/${other.sub}`,undefined,204);
    });
    await check('team-context-has-authoritative-initial-owner-memberships',async()=>{
      for(const actor of [owner,other]) {
        const context=await team(actor,'GET','/context');
        assert.equal(context.activeOrganizationId,actor.organizationId);
        assert.ok(context.memberships.some(member=>member.organizationId===actor.organizationId && member.role==='admin'),'Initial owner membership is missing.');
      }
    });
    await check('published-catalog-and-exact-price-preview',async()=>{
      const published=await invoke(outputs.CatalogFunctionName,event(owner,'POST',`/catalogs/${catalog.catalogId}/publications`,catalog));
      assert.ok([200,201].includes(published.statusCode),'Synthetic publication failed.');
      const preview=await call(outputs.QuotesFunctionName,event(owner,'POST','/quotes/preview',request),200);
      assert.equal(preview.totalMinor,'2636250','Exact BigInt pilot total differs.');
      assert.equal(preview.subtotalMinor,'2775000','Pilot subtotal differs.');
      assert.equal(preview.appliedRules[0].amountMinor,'-138750','Pilot discount differs.');
      report.price={subtotalMinor:preview.subtotalMinor,totalMinor:preview.totalMinor,currency:preview.currency};
    });
    await check('eight-concurrent-retries-one-proposal-and-conflict',async()=>{
      const key=`qa-${manifest.runId}-original`;
      const results=await Promise.all(Array.from({length:8},()=>invoke(outputs.QuotesFunctionName,event(owner,'POST','/quotes',request,key))));
      assert.ok(results.every(result=>[200,201].includes(result.statusCode)),'A retry failed.');
      const quotes=results.map(result=>JSON.parse(result.body));
      assert.equal(new Set(quotes.map(quote=>quote.quoteId)).size,1,'Concurrent retries created different proposals.');
      issued=quotes[0];assert.ok(issued.quoteId,'No proposal was issued.');
      await call(outputs.QuotesFunctionName,event(owner,'POST','/quotes',{...request,items:[{...request.items[0],quantity:6}]},key),409);
      report.proposal={quoteId:issued.quoteId,catalogId:catalog.catalogId,version:issued.version,totalMinor:issued.totalMinor,retries:8};
    });
    await check('new-catalog-prices-and-option-names-preserve-saved-snapshot',async()=>{
      const next=structuredClone(catalog);next.version=2;next.products[0].basePriceMinor='900000';
      next.products[0].options.find(option=>option.id==='oak').name='Roble premium QA v2';
      next.products[0].options.find(option=>option.id==='oak').priceMinor='120000';
      const published=await invoke(outputs.CatalogFunctionName,event(owner,'POST',`/catalogs/${catalog.catalogId}/publications`,next));
      assert.ok([200,201].includes(published.statusCode),'Second synthetic revision failed.');
      const saved=await call(outputs.QuotesFunctionName,event(owner,'GET',`/quotes/${issued.quoteId}`),200);
      assert.deepEqual(saved,issued,'Saved proposal changed after a new catalog revision.');
      assert.deepEqual(saved.lines[0].selectedOptions.find(option=>option.id==='oak'),{id:'oak',name:'Roble',priceMinor:'80000'},'Saved option details changed.');
    });
    await check('organization-boundaries-before-invitation',async()=>{
      await call(outputs.QuotesFunctionName,event(other,'GET',`/quotes/${issued.quoteId}`),404);
      await call(outputs.CatalogFunctionName,event(other,'GET',`/catalogs/${catalog.catalogId}/versions/1`),404);
    });
    await check('recipient-bound-invitation-acceptance-retry-and-second-workspace',async()=>{
      const invitation=await team(owner,'POST','/invitations',{email:other.email,role:'seller'},201);
      manifest.teamInvitation={...invitation,createdAt:new Date().toISOString()};await savePrivate();
      const token=manifest.teamInvitation.token;
      await team(owner,'GET',`/invitations/${token}`,undefined,404);
      const details=await team(other,'GET',`/invitations/${token}`);
      assert.equal(details.invitation.email,other.email);
      const first=await team(other,'POST',`/invitations/${token}/accept`,{});
      assert.equal(first.membership.organizationId,owner.organizationId);assert.equal(first.membership.role,'seller');
      const replay=await team(other,'POST',`/invitations/${token}/accept`,{});assert.deepEqual(replay,first);
      const context=await team(other,'GET','/context',undefined,200,owner.organizationId);
      assert.equal(context.activeOrganizationId,owner.organizationId);
      assert.ok(context.memberships.some(member=>member.organizationId===other.organizationId && member.role==='admin'));
      assert.ok(context.memberships.some(member=>member.organizationId===owner.organizationId && member.role==='seller'));
      await call(outputs.QuotesFunctionName,event(other,'POST','/quotes/preview',request,undefined,owner.organizationId),200);
      await call(outputs.CatalogFunctionName,event(other,'POST',`/catalogs/${catalog.catalogId}/publications`,{...catalog,version:3},undefined,owner.organizationId),403);
      report.team={recipientBound:true,acceptanceIdempotent:true,secondWorkspace:true};
    });
    await check('real-reader-demotion-overrides-stale-admin-claims',async()=>{
      const changed=await team(owner,'PATCH',`/members/${other.sub}`,{role:'reader'});
      assert.equal(changed.member.role,'reader');
      const stale=event(other,'POST','/quotes/preview',request,undefined,owner.organizationId);
      stale.requestContext.authorizer.jwt.claims['cognito:groups']=[`org:${owner.organizationId}:admin`];
      await call(outputs.QuotesFunctionName,stale,403);
      await call(outputs.CatalogFunctionName,event(other,'GET',`/catalogs/${catalog.catalogId}/versions/1`,undefined,undefined,owner.organizationId),200);
      await team(other,'GET','/members',undefined,403,owner.organizationId);
      report.team.staleClaimsIgnored=true;
    });
    await check('concurrent-last-admin-protection-and-restoration',async()=>{
      await team(owner,'PATCH',`/members/${other.sub}`,{role:'admin'});
      const results=await Promise.all([owner,other].map(actor=>invoke(outputs.TeamFunctionName,event(actor,'PATCH',`/team/members/${actor.sub}`,{role:'reader'},undefined,owner.organizationId))));
      assert.equal(results.filter(result=>result.statusCode===200).length,1,'Exactly one administrator demotion must succeed.');
      assert.equal(results.filter(result=>result.statusCode===409).length,1,'The last administrator must be protected.');
      const demoted=results[0].statusCode===200 ? owner : other;
      const remaining=demoted===owner ? other : owner;
      const protectedRoster=await team(remaining,'GET','/members',undefined,200,owner.organizationId);
      assert.equal(protectedRoster.members.filter(member=>member.role==='admin').length,1,'The race must leave exactly one administrator.');
      await team(remaining,'PATCH',`/members/${demoted.sub}`,{role:'admin'},200,owner.organizationId);
      const roster=await team(owner,'GET','/members');
      assert.equal(roster.members.filter(member=>member.role==='admin').length,2);
      report.team.lastAdminRaceProtected=true;
    });
    await check('membership-removal-immediately-blocks-business-and-used-invite-replay',async()=>{
      await team(owner,'DELETE',`/members/${other.sub}`,undefined,204);
      const stale=event(other,'POST','/quotes/preview',request,undefined,owner.organizationId);
      stale.requestContext.authorizer.jwt.claims['cognito:groups']=[`org:${owner.organizationId}:admin`];
      await call(outputs.QuotesFunctionName,stale,403);
      await call(outputs.CatalogFunctionName,event(other,'GET',`/catalogs/${catalog.catalogId}/versions/1`,undefined,undefined,owner.organizationId),403);
      await team(other,'POST',`/invitations/${manifest.teamInvitation.token}/accept`,{},409);
      const recovered=await team(other,'GET','/context',undefined,200,owner.organizationId);
      assert.equal(recovered.activeOrganizationId,other.organizationId,'A removed persisted workspace must recover to an owned workspace.');
      await team(owner,'DELETE',`/members/${owner.sub}`,undefined,409);
      await team(owner,'PATCH',`/members/${owner.sub}`,{role:'reader'},409);
      report.team.removalImmediate=true;report.team.usedInviteCannotResurrect=true;
      const fresh=await team(owner,'POST','/invitations',{email:other.email,role:'seller'},201);
      manifest.browserInvitation={...fresh,url:`${origin}/invitacion/${fresh.token}`};await savePrivate();
      report.team.pendingBrowserInvitationInPrivateArtifact=true;
    });
    await check('cloudfront-public-html-config-health-and-anonymous-business-denial',async()=>{
      for(const [path,status] of [['/',200],['/config.json',200],['/api/health',200],['/api/v1/catalogs',401]]) {
        const result=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(20_000)});
        assert.equal(result.status,status,'Unexpected public endpoint response.');
        if(path==='/') assert.ok((await result.text()).includes('CotiTrama'),'SSR HTML does not identify the product.');
        if(path==='/config.json') {const settings=await result.json();assert.equal(settings.demo,false);assert.equal(settings.auth?.clientId,outputs.UserPoolClientId);}
        if(path==='/api/health') assert.equal((await result.json()).service,'cotitrama');
      }
    });
    await check('direct-unsigned-ssr-function-url-is-denied',async()=>{
      const resources=await awsJson(['cloudformation','list-stack-resources'],['--stack-name',stackName]);
      const web=resources.StackResourceSummaries?.find(resource=>resource.LogicalResourceId==='WebFunction' && resource.ResourceType==='AWS::Lambda::Function');
      assert.ok(web?.PhysicalResourceId?.startsWith(`${stackName}-`),'SSR function ownership guard failed.');
      const config=await lambda.send(new lambdaSdk.GetFunctionUrlConfigCommand({FunctionName:web.PhysicalResourceId}));
      assert.equal(config.AuthType,'AWS_IAM','SSR Function URL must require IAM.');
      const url=new URL(config.FunctionUrl);assert.ok(url.hostname.endsWith(`.lambda-url.${region}.on.aws`),'Unexpected Function URL host.');
      const result=await fetch(url,{signal:AbortSignal.timeout(20_000)});assert.equal(result.status,403,'Unsigned direct SSR invocation must fail.');
    });
    report.completedAt=new Date().toISOString();report.ok=true;await saveReport();
    console.log('CotiTrama development AWS smoke passed. Report: artifacts/aws-smoke.json. JWT browser QA remains separate.');
    return report;
  } catch(error) {
    report.ok=false;report.failure={name:error?.name ?? 'Error',check:report.checks.at(-1)?.name ?? 'prepare'};
    await saveReport();throw error;
  } finally {cognito.destroy();lambda.destroy();}
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{
    // Deliberately omit SDK messages, request objects, credentials and token payloads.
    console.error(`CotiTrama development AWS smoke failed (${error?.name ?? 'Error'}). See artifacts/aws-smoke.json when present.`);
    process.exitCode=1;
  });
}
