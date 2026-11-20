import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../services/shared/http.mjs';
const api=await import('./applications-smoke.mjs').catch(()=>({}));
const runId='1795123456789-abcdef',reference='aaaaaaaa-1111-4111-8111-111111111111';
const context={stackName:'cotitrama-development',region:'us-east-1',interestTable:'cotitrama-development-InterestTable-Example',outputs:{PublicUrl:'https://cotitrama-dev.lynxpardelle.com',UserPoolId:'us-east-1_Example1',ApplicationsFunctionName:'cotitrama-development-ApplicationsFunction-Example'}};
const actors=Object.fromEntries(['owner','a','b'].map((label,index)=>[label,{email:`ct-quota-${label}-${runId}@example.invalid`,username:`${index+2}2222222-2222-4222-8222-222222222222`,sub:`${index+2}2222222-2222-4222-8222-222222222222`}]));
function fixture(){
  assert.equal(typeof api.applicationFixture,'function');
  const body=api.applicationFixture(runId,reference);const createdAt='2026-11-19T12:00:00.000Z',expiresAt=Date.parse(createdAt)/1000+90*86400;
  const manifest={version:1,runId,stackName:context.stackName,region:context.region,userPoolId:context.outputs.UserPoolId,interestTable:context.interestTable,actors,application:{reference,body}};
  const root={PK:`INTEREST#${reference}`,SK:'RECORD',reference,status:'received',createdAt,expiresAt,requestHash:hash(body),record:{...body,status:'received',createdAt,acceptedAt:createdAt,expiresAt}};
  return {body,manifest,root};
}
test('QA fixture has one exact synthetic namespace and never accepts a real email or arbitrary run identifier',()=>{
  const {body}=fixture();assert.equal(body.contactEmail,`ct-applications-${runId}@example.invalid`);assert.equal(body.requestId,reference);assert.equal(body.contactConsent,true);
  for(const run of ['real@example.com','../../outside','',`${runId}@evil.invalid`])assert.throws(()=>api.applicationFixture(run,reference));
  for(const id of ['not-a-uuid','../RECORD',reference.toUpperCase()])assert.throws(()=>api.applicationFixture(runId,id));
});
test('QA context refuses another project, region, pool or table before AWS operations',()=>{
  assert.equal(typeof api.validateApplicationsContext,'function');assert.doesNotThrow(()=>api.validateApplicationsContext(context));
  for(const value of [{...context,stackName:'other-project'},{...context,region:'us-west-2'},{...context,interestTable:'other-project-InterestTable-X'},{...context,outputs:{...context.outputs,UserPoolId:'us-west-2_Other'}},{...context,outputs:{...context.outputs,ApplicationsFunctionName:'other-project-ApplicationsFunction-X'}}])assert.throws(()=>api.validateApplicationsContext(value));
});
test('QA manifest rejects real contacts, substituted references and actors outside the three recorded synthetic accounts',()=>{
  const {manifest}=fixture();assert.equal(typeof api.validateApplicationsManifest,'function');assert.doesNotThrow(()=>api.validateApplicationsManifest(manifest,context));
  const changed=alter=>{const copy=structuredClone(manifest);alter(copy);return copy;};
  for(const value of [changed(m=>m.application.body.contactEmail='real@example.com'),changed(m=>m.application.reference='99999999-9999-4999-8999-999999999999'),changed(m=>m.actors.owner.email='real@example.com'),changed(m=>m.actors.owner.sub='not-a-uuid'),changed(m=>m.interestTable='other-project-InterestTable-X'),changed(m=>m.actors.extra=m.actors.a)])assert.throws(()=>api.validateApplicationsManifest(value,context));
});
test('an original QA record is proved from exact body, hash, status and original ninety day deadline',()=>{
  const {manifest,root}=fixture();assert.equal(typeof api.validateApplicationRoot,'function');const original=api.validateApplicationRoot(root,manifest);manifest.original=original;
  assert.deepEqual(api.validateApplicationRoot({...root,review:{status:'reviewing',version:1,updatedAt:root.createdAt,nextActionDate:''}},manifest),original);
  for(const altered of [{...root,PK:'INTEREST#99999999-9999-4999-8999-999999999999'},{...root,requestHash:'another'},{...root,status:'selected'},{...root,expiresAt:root.expiresAt+1},{...root,record:{...root.record,contactEmail:'real@example.com'}},{...root,record:{...root.record,acceptedAt:'2026-11-20T12:00:00.000Z'}}])assert.throws(()=>api.validateApplicationRoot(altered,manifest));
});
test('cleanup accepts only own root, review and replay keys sharing the captured original TTL',()=>{
  const {manifest,root}=fixture();manifest.original=api.validateApplicationRoot(root,manifest);assert.equal(typeof api.validateApplicationRows,'function');
  const review={PK:root.PK,SK:'REVIEW#000000000001',expiresAt:root.expiresAt},replay={PK:root.PK,SK:'REPLAY#22222222-2222-4222-8222-222222222222',expiresAt:root.expiresAt};
  assert.doesNotThrow(()=>api.validateApplicationRows([root,review,replay],manifest));
  for(const row of [{...review,PK:'INTEREST#99999999-9999-4999-8999-999999999999'},{...review,SK:'MEMBER#somebody'},{...review,SK:'DAILY#2026-11-19'},{...review,SK:'REVIEW#1'},{...replay,SK:'REPLAY#not-a-uuid'},{...review,expiresAt:root.expiresAt+1},{PK:'DAILY#2026-11-19',SK:'COUNTER',expiresAt:root.expiresAt}])assert.throws(()=>api.validateApplicationRows([row],manifest));
});
