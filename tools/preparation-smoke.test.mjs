import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../services/shared/http.mjs';
import {ownOrganization} from '../services/team/domain.mjs';
const api=await import('./preparation-smoke.mjs').catch(()=>({}));
const runId='1795135411508-abcdef',reference='11111111-1111-4111-8111-111111111111';
const context={region:'us-east-1',stackName:'cotitrama-development',interestTable:'cotitrama-development-InterestTable-Example',outputs:{PublicUrl:'https://cotitrama-dev.lynxpardelle.com',UserPoolId:'us-east-1_Example',ApplicationsFunctionName:'cotitrama-development-ApplicationsFunction-Example'}};
function fixture(){
 assert.equal(typeof api.preparationFixture,'function');
 const actors=Object.fromEntries(['owner','a','b'].map((label,index)=>{const sub=`${index+2}2222222-2222-4222-8222-222222222222`;return[label,{sub,username:sub,email:`ct-quota-${label}-${runId}@example.invalid`,organizationId:ownOrganization(context.outputs.UserPoolId,sub)}];}));
 const body=api.preparationFixture(runId,reference),createdAt='2026-11-19T12:00:00.000Z',expiresAt=Date.parse(createdAt)/1000+90*86400;
 const manifest={version:1,runId,region:context.region,stackName:context.stackName,userPoolId:context.outputs.UserPoolId,interestTable:context.interestTable,actors,application:{reference,body},catalogId:`prep-${runId}`};
 const item={PK:`INTEREST#${reference}`,SK:'RECORD',reference,status:'received',createdAt,expiresAt,requestHash:hash(body),record:{...body,status:'received',createdAt,acceptedAt:createdAt,expiresAt}};
 return{manifest,item};
}
test('preparation QA uses the exact generated contact account and a canonical own reference',()=>{
 const {manifest}=fixture();assert.equal(manifest.application.body.contactEmail,manifest.actors.a.email);
 for(const bad of ['real@example.com','../outside',''])assert.throws(()=>api.preparationFixture(bad,reference));
 assert.throws(()=>api.preparationFixture(runId,'not-a-reference'));
});
test('preparation QA cannot target another environment, table, actor or commercial organization',()=>{
 const {manifest}=fixture();assert.equal(typeof api.validatePreparationManifest,'function');assert.doesNotThrow(()=>api.validatePreparationManifest(manifest,context));
 for(const alter of [m=>m.actors.a.email='real@example.com',m=>m.actors.b.organizationId=m.actors.a.organizationId,m=>m.catalogId='real-catalog',m=>m.application.body.contactEmail='real@example.com',m=>m.interestTable='other-table']){const copy=structuredClone(manifest);alter(copy);assert.throws(()=>api.validatePreparationManifest(copy,context));}
 assert.throws(()=>api.validatePreparationManifest(manifest,{...context,stackName:'other-project'}));
});
test('preparation QA preserves the received original while review and preparation evolve separately',()=>{
 const {manifest,item}=fixture();assert.equal(typeof api.validatePreparationRoot,'function');manifest.original=api.validatePreparationRoot(item,manifest);
 assert.doesNotThrow(()=>api.validatePreparationRoot({...item,review:{status:'selected',version:1},preparation:{version:2}},manifest));
 for(const altered of [{...item,expiresAt:item.expiresAt+1},{...item,requestHash:'other'},{...item,record:{...item.record,contactEmail:'real@example.com'}}])assert.throws(()=>api.validatePreparationRoot(altered,manifest));
});
test('cleanup accepts only this intake and its review and preparation children with the original deadline',()=>{
 const {manifest,item}=fixture();manifest.original=api.validatePreparationRoot(item,manifest);assert.equal(typeof api.validatePreparationRows,'function');
 const child=SK=>({PK:item.PK,SK,expiresAt:item.expiresAt});const rows=[item,child('REVIEW#000000000001'),child(`REPLAY#${reference}`),child('PREP_HISTORY#000000000001'),child(`PREP_REPLAY#${reference}`)];
 assert.doesNotThrow(()=>api.validatePreparationRows(rows,manifest));
 for(const invalid of [child('PREP_HISTORY#1'),child('CATALOG#live'),{...child('PREP_HISTORY#000000000001'),expiresAt:item.expiresAt+1},{...child('PREP_HISTORY#000000000001'),PK:'DAILY#2026-11-19'}])assert.throws(()=>api.validatePreparationRows([invalid],manifest));
});
