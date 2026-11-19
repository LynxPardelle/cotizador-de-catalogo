import test from 'node:test';
import assert from 'node:assert/strict';
import { ownOrganization } from '../services/team/domain.mjs';
const module=await import('./pilot-metrics-smoke.mjs').catch(()=>({}));
const pool='us-east-1_Example1',runId='20261119-abcdef';
const context={region:'us-east-1',stackName:'cotitrama-development',outputs:{UserPoolId:pool,PublicUrl:'https://cotitrama-dev.lynxpardelle.com'},tables:Object.fromEntries(['MembersTable','CatalogTable','QuotesTable'].map(key=>[key,`cotitrama-development-${key}-example`]))};
const fixture=()=>({version:1,runId,region:context.region,stackName:context.stackName,userPoolId:pool,actors:Object.fromEntries(['owner','a','b'].map((label,i)=>{
  const sub=`${String(i+1).repeat(8)}-1111-4111-8111-111111111111`;
  return [label,{email:`ct-quota-${label}-${runId}@example.invalid`,username:sub,sub,created:true,onboarded:true,organizationId:ownOrganization(pool,sub),group:`org:${ownOrganization(pool,sub)}:admin`}];
}))});
test('pilot fixtures require prepared quota actors, exact development tables and synthetic owned organizations',()=>{
  assert.equal(typeof module.validatePilotFixture,'function');assert.doesNotThrow(()=>module.validatePilotFixture(fixture(),context));
  for(const change of [m=>m.actors.owner.email='human@example.com',m=>m.actors.a.organizationId=m.actors.owner.organizationId,m=>m.actors.b.onboarded=false,m=>m.actors.a.deleted=true]) {const state=fixture();change(state);assert.throws(()=>module.validatePilotFixture(state,context));}
  assert.throws(()=>module.validatePilotFixture(fixture(),{...context,tables:{...context.tables,QuotesTable:'other-project-quotes'}}));
});
test('dashboard acceptance rejects private identity fields and actual actor identifiers anywhere in aggregates',()=>{
  assert.equal(typeof module.assertAggregatePrivacy,'function');
  assert.doesNotThrow(()=>module.assertAggregatePrivacy({totalIssued:3,activeIssuers:1,daily:[]},['private@example.invalid']));
  assert.throws(()=>module.assertAggregatePrivacy({daily:[{actorKey:'opaque-private-value'}]},[]));
  assert.throws(()=>module.assertAggregatePrivacy({details:{value:'private@example.invalid'}},['private@example.invalid']));
});
