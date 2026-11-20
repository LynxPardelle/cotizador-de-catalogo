import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./preparation-client.mjs').catch(()=>({}));
const subject='11111111-1111-4111-8111-111111111111';
function setup(results){assert.equal(typeof api.createPreparationServices,'function');const calls=[];return {calls,services:api.createPreparationServices({functionName:'own-team',catalogFunctionName:'own-catalog',client:{async send(command){calls.push(command);return results.shift();}}})};}
const output=value=>({Payload:Buffer.from(JSON.stringify(value))});
test('preparation calls only IAM envelopes and exposes minimal workspace and readiness contracts',async()=>{
 const {calls,services}=setup([output([{workspaceId:'org-a',label:'Espacio org-a',email:'private@example.invalid'}]),output({adminReady:true,sellerReady:true,verifiedMembers:2,email:'private@example.invalid'})]);
 assert.deepEqual(await services.workspaces(subject),[{workspaceId:'org-a',label:'Espacio org-a'}]);assert.deepEqual(await services.access(subject,'org-a'),{adminReady:true,sellerReady:true,verifiedMembers:2});
 assert.deepEqual(calls.map(command=>JSON.parse(command.input.Payload.toString())),[{operation:'pilotAdminWorkspaces',subject},{operation:'pilotReadiness',subject,organizationId:'org-a'}]);assert.ok(calls.every(command=>command.input.FunctionName==='own-team'));
});
test('current membership denial becomes a false readiness and unavailable checks fail closed',async()=>{
 const {services}=setup([output({error:{statusCode:403,code:'MEMBERSHIP_REQUIRED',message:'private'}}),output({error:{statusCode:503,code:'PILOT_TEAM_LIMIT',message:'private'}}),{FunctionError:'Unhandled'}]);
 assert.deepEqual(await services.access(subject,'org-a'),{adminReady:false,sellerReady:false,verifiedMembers:0});await assert.rejects(services.access(subject,'org-a'),{statusCode:503});await assert.rejects(services.workspaces(subject),{statusCode:503});
});
test('published catalog is reduced to metadata and expired versions cannot satisfy preparation',async()=>{
 const catalog={catalogId:'catalog-a',version:2,name:'Catálogo autorizado',validUntil:'2099-01-01T00:00:00.000Z',products:[{basePriceMinor:123456}],rules:[{numerator:25}]};
 const {calls,services}=setup([output(catalog),output(null),output({...catalog,validUntil:'2000-01-01T00:00:00.000Z'})]);
 assert.deepEqual(await services.catalog('org-a','catalog-a',2),{catalogId:'catalog-a',version:2,name:'Catálogo autorizado',validUntil:catalog.validUntil,productCount:1});assert.equal(await services.catalog('org-a','catalog-a',2),null);assert.equal(await services.catalog('org-a','catalog-a',2),null);
 assert.equal(calls[0].input.FunctionName,'own-catalog');assert.deepEqual(JSON.parse(calls[0].input.Payload.toString()),{operation:'getPublishedCatalog',organizationId:'org-a',catalogId:'catalog-a',version:2});
});
test('malformed dependency responses and mismatched catalog identity fail closed',async()=>{
 for(const value of [{adminReady:true,sellerReady:true,verifiedMembers:26},{adminReady:true,sellerReady:'true',verifiedMembers:2},{adminReady:true,sellerReady:true,verifiedMembers:1},{adminReady:true,sellerReady:false,verifiedMembers:0},{adminReady:false,sellerReady:true,verifiedMembers:2}]){const {services}=setup([output(value)]);await assert.rejects(services.access(subject,'org-a'),{statusCode:503});}
 const {services}=setup([output({catalogId:'another',version:1,name:'Private',validUntil:'2099-01-01T00:00:00.000Z',products:[{}]})]);await assert.rejects(services.catalog('org-a','catalog-a',1),{statusCode:503});
});

test('metadata honors the published catalog name limit and rejects noncanonical expiry dates',async()=>{
 const catalog={catalogId:'catalog-a',version:1,name:'a'.repeat(120),validUntil:'2099-01-01T00:00:00Z',products:[{}]};
 const {services}=setup([output(catalog),output({...catalog,validUntil:'2099-02-31T00:00:00Z'})]);
 assert.equal((await services.catalog('org-a','catalog-a',1)).name,catalog.name);
 await assert.rejects(services.catalog('org-a','catalog-a',1),{statusCode:503});
});
