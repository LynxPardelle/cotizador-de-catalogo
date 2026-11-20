import test from 'node:test';
import assert from 'node:assert/strict';
import {createInterestHandler} from '../interest/index.mjs';
import {createMemoryInterestRepository} from '../interest/memory.mjs';
import {createMemoryApplicationsRepository} from './memory.mjs';

test('shared demo storage keeps the public receipt, consent, hash and quota after private follow-up',async()=>{
 const reference='11111111-1111-4111-8111-111111111111',itemsMap=new Map(),now=new Date('2026-11-20T12:00:00Z');
 const repository=createMemoryInterestRepository({itemsMap}),applications=createMemoryApplicationsRepository({itemsMap});
 const intake=createInterestHandler({repository,clock:()=>now,dailyLimit:1});
 const body={requestId:reference,organizationName:'Oficina piloto',contactEmail:'equipo@example.invalid',sector:'Mobiliario',currentMethod:'spreadsheets',monthlyQuotes:'21-100',twoParticipants:'yes',timeAvailability:'not-sure',contactConsent:true,privacyVersion:'2026-11-19'};
 const event=value=>({version:'2.0',rawPath:'/api/v1/pilot-interest',headers:{},body:JSON.stringify(value),requestContext:{requestId:'intake-compat',http:{method:'POST'}}});
 const first=await intake(event(body));assert.equal(first.statusCode,202);
 const original=structuredClone(await repository.get(reference));assert.equal(original.PK,`INTEREST#${reference}`);
 await applications.update(reference,{mutationId:'22222222-2222-4222-8222-222222222222',expectedVersion:0,status:'withdrawn',nextActionDate:'',note:'Retiro informado.'},{actorKey:'a'.repeat(64),now});
 assert.equal((await applications.detail(reference,now)).review.status,'withdrawn');
 const repeated=await intake(event(body));assert.equal(repeated.statusCode,202);assert.equal(repeated.body,first.body);
 const after=await repository.get(reference);assert.deepEqual(after.record,original.record);assert.equal(after.requestHash,original.requestHash);assert.equal(after.status,'received');assert.equal(after.expiresAt,original.expiresAt);assert.equal(after.review.status,'withdrawn');
 assert.equal((await intake(event({...body,sector:'Otro sector'}))).statusCode,409);
 assert.equal((await intake(event({...body,requestId:'33333333-3333-4333-8333-333333333333'}))).statusCode,429);
});
