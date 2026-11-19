import test from 'node:test';
import assert from 'node:assert/strict';
import { ownOrganization } from '../services/team/domain.mjs';
const module=await import('./quota-smoke.mjs').catch(()=>({}));
const pool='us-east-1_Example1';
const runId='20261119-abcdef';
const context={region:'us-east-1',stackName:'cotitrama-development',outputs:{UserPoolId:pool,PublicUrl:'https://cotitrama-dev.lynxpardelle.com'},tables:{MembersTable:'cotitrama-development-MembersTable-abc',CatalogTable:'cotitrama-development-CatalogTable-abc',QuotesTable:'cotitrama-development-QuotesTable-abc'}};
const manifest=()=>({version:1,runId,region:context.region,stackName:context.stackName,userPoolId:pool,actors:Object.fromEntries(['owner','a','b'].map((label,i)=>{
  const n=String(i+1),sub=`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
  return [label,{email:`ct-quota-${label}-${runId}@example.invalid`,username:sub,sub,created:true,organizationId:ownOrganization(pool,sub),group:`org:${ownOrganization(pool,sub)}:admin`}];
}))});
test('quota manifest accepts exactly three synthetic actors with deterministic owned organizations',()=>{
  assert.equal(typeof module.validateQuotaManifest,'function');
  assert.doesNotThrow(()=>module.validateQuotaManifest(manifest(),context));
  for(const change of [m=>m.actors.owner.email='human@example.com',m=>m.actors.a.organizationId=m.actors.owner.organizationId,m=>m.userPoolId='us-east-1_Other',m=>m.actors.extra=m.actors.a,m=>m.actors.b.group='org:unrelated:admin']) {
    const value=manifest();change(value);assert.throws(()=>module.validateQuotaManifest(value,context));
  }
});
test('boundary seed guard permits only counter fields of the recorded synthetic organization in exact development tables',()=>{
  assert.equal(typeof module.validateQuotaSeed,'function');
  const state=manifest(),org=state.actors.owner.organizationId;
  const seed={actor:'owner',table:'QuotesTable',key:{PK:`ORG#${org}`,SK:'USAGE#2026-11'},field:'used'};
  assert.doesNotThrow(()=>module.validateQuotaSeed(context,state,seed));
  for(const patch of [{key:{PK:'ORG#human',SK:'USAGE#2026-11'}},{key:{PK:`ORG#${org}`,SK:'QUOTE#existing'}},{field:'planId'},{table:'UnknownTable'},{actor:'someone'}]) assert.throws(()=>module.validateQuotaSeed(context,state,{...seed,...patch}));
  assert.throws(()=>module.validateQuotaSeed({...context,tables:{...context.tables,QuotesTable:'cotitrama-production-QuotesTable-abc'}},state,seed));
});
