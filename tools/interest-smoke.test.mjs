import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('./interest-smoke.mjs').catch(()=>({}));
const runId='20261119-abcdef';
const input={requestId:'11111111-1111-4111-8111-111111111111',organizationName:'Organización ficticia QA convocatoria',contactEmail:`ct-interest-api-${runId}@example.invalid`,sector:'Práctica sintética',currentMethod:'spreadsheets',monthlyQuotes:'1-20',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'};
test('interest QA only permits recorded synthetic namespace and no arbitrary organizational data',()=>{
 assert.equal(typeof module.validateSyntheticInterest,'function');assert.doesNotThrow(()=>module.validateSyntheticInterest(input,runId,'api'));
 for(const altered of [{...input,contactEmail:'human@example.com'},{...input,organizationName:'A real business'},{...input,requestId:'invalid'}])assert.throws(()=>module.validateSyntheticInterest(altered,runId,'api'));
 assert.throws(()=>module.validateSyntheticInterest(input,runId,'browser'));
});
test('public interest receipt must reveal only the submitted reference and received state',()=>{
 assert.equal(typeof module.assertInterestReceipt,'function');assert.doesNotThrow(()=>module.assertInterestReceipt({reference:input.requestId,status:'received'},input.requestId));
 assert.throws(()=>module.assertInterestReceipt({reference:input.requestId,status:'accepted'},input.requestId));
 assert.throws(()=>module.assertInterestReceipt({reference:input.requestId,status:'received',contactEmail:input.contactEmail},input.requestId));
});
