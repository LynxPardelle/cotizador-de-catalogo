import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCatalogHandler } from '../catalog/index.mjs';
import { createQuotingHandler } from '../quoting/index.mjs';
import { createMemoryRepositories } from '../shared/memory.mjs';
import { HttpError } from '../shared/errors.mjs';
import { syntheticCatalog } from '../fixtures/catalog.mjs';
import { planFor } from '../shared/quota.mjs';
const teamModule=await import('./index.mjs').catch(()=>({}));
const memoryModule=await import('./memory.mjs').catch(()=>({}));
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const c='33333333-3333-4333-8333-333333333333';
const tokenHash=token=>createHash('sha256').update(token).digest('hex');
const token='A'.repeat(43);
function event(subject,method,path,body,org) {
  return {version:'2.0',rawPath:`/api/v1/team${path}`,headers:org ? {'x-organization-id':org} : {},body:body===undefined ? undefined : JSON.stringify(body),requestContext:{requestId:'team-test',http:{method},authorizer:{jwt:{claims:{sub:subject,token_use:'access','cognito:groups':['org:untrusted-claim:admin']}}}}};
}
const decode=r=>({status:r.statusCode,...(r.body ? {body:JSON.parse(r.body)} : {})});
function setup() {
  assert.equal(typeof teamModule.createTeamHandler,'function');assert.equal(typeof memoryModule.createMemoryTeamRepository,'function');
  const repository=memoryModule.createMemoryTeamRepository();
  let now=new Date('2026-11-20T12:00:00.000Z');
  const userMap=new Map([[a,{subject:a,email:'owner@example.invalid',emailVerified:true}],[b,{subject:b,email:'other@example.invalid',emailVerified:true}],[c,{subject:c,email:'third@example.invalid',emailVerified:true}]]);
  const groupMap=new Map([[a,['org:org-a:admin']],[b,['org:org-b:admin']],[c,['org:org-a:reader']]]);
  const users={get:async subject=>userMap.get(subject),groups:async subject=>groupMap.get(subject) ?? []};
  const handler=teamModule.createTeamHandler({repository,users,clock:()=>new Date(now),newToken:()=>token});
  return {repository,handler,users,userMap,groupMap,advance:days=>{now=new Date(now.getTime()+days*86400000);}};
}
test('membership context uses server-side migration and supports an invited second organization',async()=>{
  const {handler}=setup();
  const first=decode(await handler(event(a,'GET','/context')));
  assert.equal(first.status,200);assert.equal(first.body.activeOrganizationId,'org-a');
  assert.deepEqual(first.body.memberships.map(m=>[m.organizationId,m.role]),[['org-a','admin']]);
  const invitation=decode(await handler(event(a,'POST','/invitations',{email:' OTHER@EXAMPLE.INVALID ',role:'seller'}))).body;
  assert.equal(invitation.token,token);assert.equal(invitation.invitation.email,'other@example.invalid');
  const accepted=decode(await handler(event(b,'POST',`/invitations/${token}/accept`,{})));
  assert.equal(accepted.status,200);assert.equal(accepted.body.membership.organizationId,'org-a');assert.equal(accepted.body.membership.role,'seller');
  const second=decode(await handler(event(b,'GET','/context'))).body;
  assert.equal(second.activeOrganizationId,'org-b');assert.equal(second.memberships.length,2);
  const selected=decode(await handler(event(b,'GET','/context',undefined,'org-a'))).body;
  assert.equal(selected.activeOrganizationId,'org-a');
  const auth=await handler({operation:'authorizeMembership',subject:b,organizationId:'org-a'});
  assert.deepEqual(auth,{subject:b,organizationId:'org-a',role:'seller',plan:planFor()});
});
test('invitation persists only token hash, requires recipient email verification and has logical expiry',async()=>{
  const {handler,repository,userMap,advance}=setup();
  await handler(event(a,'POST','/invitations',{email:'other@example.invalid',role:'reader'}));
  const saved=await repository.invitation(tokenHash(token));
  assert.ok(saved);assert.ok(!JSON.stringify(saved).includes(token));
  assert.equal(decode(await handler(event(a,'GET',`/invitations/${token}`))).status,404);
  userMap.get(b).emailVerified=false;
  assert.equal(decode(await handler(event(b,'GET',`/invitations/${token}`))).status,403);
  userMap.get(b).emailVerified=true;
  assert.equal(decode(await handler(event(b,'GET',`/invitations/${token}`))).status,200);
  advance(8);
  assert.equal(decode(await handler(event(b,'GET',`/invitations/${token}`))).status,410);
  assert.equal(decode(await handler(event(b,'POST',`/invitations/${token}/accept`,{}))).status,410);
});
test('acceptance is idempotent and a removed membership cannot be resurrected by invite replay',async()=>{
  const {handler,advance}=setup();
  await handler(event(a,'POST','/invitations',{email:'other@example.invalid',role:'seller'}));
  const first=decode(await handler(event(b,'POST',`/invitations/${token}/accept`,{})));
  advance(8);
  const second=decode(await handler(event(b,'POST',`/invitations/${token}/accept`,{})));
  assert.deepEqual(first,second);
  assert.equal(decode(await handler(event(a,'DELETE',`/members/${b}`,undefined,'org-a'))).status,204);
  assert.equal(decode(await handler(event(b,'POST',`/invitations/${token}/accept`,{}))).status,409);
  assert.equal(decode(await handler(event(b,'GET','/context',undefined,'org-a'))).body.activeOrganizationId,'org-b');
});
test('role changes and removal take effect immediately despite stale JWT groups',async()=>{
  const {handler}=setup();
  await handler(event(a,'GET','/context'));
  await handler(event(c,'GET','/context'));
  const grant=decode(await handler(event(a,'PATCH',`/members/${c}`,{role:'seller'})));
  assert.equal(grant.status,200);assert.equal(grant.body.member.role,'seller');
  assert.equal((await handler({operation:'authorizeMembership',subject:c,organizationId:'org-a'})).role,'seller');
  assert.equal(decode(await handler(event(c,'POST','/invitations',{email:'other@example.invalid',role:'admin'}))).status,403);
  assert.equal(decode(await handler(event(a,'DELETE',`/members/${c}`))).status,204);
  assert.equal((await handler({operation:'authorizeMembership',subject:c,organizationId:'org-a'})).error.statusCode,403);
  const context=decode(await handler(event(c,'GET','/context'))).body;
  assert.deepEqual(context.memberships,[]);assert.equal(context.activeOrganizationId,null);
});
test('concurrent last-admin demotions cannot leave an organization without an administrator',async()=>{
  const {handler,repository}=setup();
  await handler(event(a,'POST','/invitations',{email:'other@example.invalid',role:'admin'}));
  await handler(event(b,'POST',`/invitations/${token}/accept`,{}));
  const results=await Promise.allSettled([
    repository.changeRole('org-a',a,a,'reader'),
    repository.changeRole('org-a',b,b,'reader'),
  ]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.filter(result=>result.status==='rejected' && result.reason.code==='LAST_ADMIN').length,1);
  assert.equal((await repository.members('org-a')).filter(member=>member.role==='admin').length,1);
});
test('HTTP requests cannot impersonate internal authorization and workspace header must be owned',async()=>{
  const {handler}=setup();
  const forged=event(a,'GET','/members');delete forged.requestContext.authorizer;forged.operation='authorizeMembership';forged.subject=a;
  assert.equal(decode(await handler(forged)).status,401);
  assert.equal(decode(await handler(event(a,'GET','/context',undefined,'untrusted-claim'))).body.activeOrganizationId,'org-a');
  assert.equal((await handler({operation:'authorizeMembership',subject:a,organizationId:'untrusted-claim'})).error.statusCode,403);
});

test('catalog and quotation handlers lose access on the next request after team removal',async()=>{
  const {handler}=setup();
  await handler(event(a,'GET','/context'));await handler(event(c,'GET','/context'));
  await handler(event(a,'PATCH',`/members/${c}`,{role:'seller'}));
  const repositories=createMemoryRepositories();
  const authorize=async input=>{
    const result=await handler({operation:'authorizeMembership',subject:input.requestContext.authorizer.jwt.claims.sub,organizationId:'org-a'});
    if(result.error) throw new HttpError(result.error.statusCode,result.error.code,result.error.message);return result;
  };
  const catalog=createCatalogHandler({repository:repositories.catalog,authorize});
  const quotes=createQuotingHandler({repository:repositories.quotes,readCatalog:(org,id,version)=>repositories.catalog.get(org,id,version),authorize});
  const business=(subject,method,path,body)=>{const input=event(subject,method,'',body);input.rawPath=`/api/v1${path}`;return input;};
  assert.equal((await catalog(business(a,'POST','/catalogs/oficina/publications',syntheticCatalog))).statusCode,201);
  const input={catalogId:'oficina',version:1,currency:'MXN',items:[{productId:'desk',quantity:1,optionIds:[]}]};
  assert.equal((await quotes(business(c,'POST','/quotes/preview',input))).statusCode,200);
  assert.equal((await catalog(business(c,'POST','/catalogs/oficina/publications',{...syntheticCatalog,version:2}))).statusCode,403);
  await handler(event(a,'DELETE',`/members/${c}`));
  assert.equal((await quotes(business(c,'POST','/quotes/preview',input))).statusCode,403);
  assert.equal((await catalog(business(c,'GET','/catalogs/oficina/versions/1'))).statusCode,403);
});
