import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { HttpError, notFound } from '../shared/errors.mjs';
import { noAccess, lastAdmin, membershipConflict, invitationForRecipient } from './domain.mjs';
import { planFor, usageMetric, quotaExceeded } from '../shared/quota.mjs';

const userKey=(subject,organizationId)=>({PK:`USER#${subject}`,SK:`ORG#${organizationId}`});
const orgKey=(organizationId,subject)=>({PK:`ORG#${organizationId}`,SK:`MEMBER#${subject}`});
const profileKey=subject=>({PK:`USER#${subject}`,SK:'PROFILE'});
const metaKey=organizationId=>({PK:`ORG#${organizationId}`,SK:'META'});
const inviteKey=hash=>({PK:`INVITE#${hash}`,SK:'INVITE'});
const roleNames={'#member':'member','#role':'role'};
const missing='attribute_not_exists(PK)';

export function createDynamoTeamRepository({client=DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}}),table=process.env.MEMBERS_TABLE}={}) {
  if(!table) throw new Error('Missing members table configuration');
  const get=async Key=>(await client.send(new GetCommand({TableName:table,Key,ConsistentRead:true}))).Item;
  const put=(Key,value,ConditionExpression=missing,extra={})=>({Put:{TableName:table,Item:{...Key,...value},ConditionExpression,...extra}});
  const caller=(org,subject)=>({ConditionCheck:{TableName:table,Key:userKey(subject,org),ConditionExpression:'#member.#role = :admin',ExpressionAttributeNames:roleNames,ExpressionAttributeValues:{':admin':'admin'}}});
  const counter=(org,delta,last=false,memberDelta=0,limit,planId)=>{
    const conditions=last ? ['adminCount > :one'] : [];
    if(memberDelta) conditions.push(memberDelta>0 ? (limit===undefined ? 'attribute_exists(memberCount)' : 'memberCount < :limit') : 'memberCount > :zero');
    if(planId) conditions.push(planId==='esencial' ? '(attribute_not_exists(planId) OR planId = :planId)' : 'planId = :planId');
    return {Update:{TableName:table,Key:metaKey(org),UpdateExpression:`ADD adminCount :delta${memberDelta ? ', memberCount :membersDelta' : ''}`,...(conditions.length ? {ConditionExpression:conditions.join(' AND ')} : {}),ExpressionAttributeValues:{':delta':delta,...(last ? {':one':1} : {}),...(memberDelta ? {':membersDelta':memberDelta} : {}),...(memberDelta<0 ? {':zero':0} : {}),...(limit!==undefined ? {':limit':limit} : {}),...(planId ? {':planId':planId} : {})}}};
  };
  const transaction=TransactItems=>client.send(new TransactWriteCommand({TransactItems}));
  async function query(PK,prefix,field) {
    const results=[];let ExclusiveStartKey;
    do {
      const page=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':PK,':prefix':prefix},ConsistentRead:true,ExclusiveStartKey}));
      results.push(...(page.Items ?? []).map(item=>item[field]));ExclusiveStartKey=page.LastEvaluatedKey;
    } while(ExclusiveStartKey);
    return results;
  }
  async function ensureMemberCounter(org) {
    const meta=await get(metaKey(org));
    if(Number.isSafeInteger(meta?.memberCount) && meta.memberCount>=0) return meta;
    const count=(await query(`ORG#${org}`,'MEMBER#','member')).length;
    try {
      const result=await client.send(new UpdateCommand({TableName:table,Key:metaKey(org),UpdateExpression:'SET memberCount = :count',ConditionExpression:'attribute_not_exists(memberCount)',ExpressionAttributeValues:{':count':count},ReturnValues:'ALL_NEW'}));
      return {...meta,...result.Attributes,memberCount:count};
    } catch(error) {
      if(error.name!=='ConditionalCheckFailedException') throw error;
      const current=await get(metaKey(org));
      if(Number.isSafeInteger(current?.memberCount) && current.memberCount>=0) return current;
      throw new HttpError(503,'USAGE_UNAVAILABLE','No pudimos comprobar el consumo de miembros.');
    }
  }
  async function pilotQuery(PK,prefix,limit){
    const results=[];let ExclusiveStartKey;
    for(let page=0;page<4;page++){
      const result=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':PK,':prefix':prefix},ConsistentRead:true,Limit:limit+1-results.length,ExclusiveStartKey}));
      results.push(...(result.Items??[]).map(item=>item.member));
      if(results.length>limit)throw new HttpError(503,'PILOT_TEAM_LIMIT','El equipo supera el presupuesto de verificación del piloto.');
      ExclusiveStartKey=result.LastEvaluatedKey;if(!ExclusiveStartKey)return results;
    }
    throw new HttpError(503,'PILOT_TEAM_LIMIT','No pudimos completar la verificación del equipo dentro de su presupuesto.');
  }
  const repository={
    async pilotMemberships(subject){return pilotQuery(`USER#${subject}`,'ORG#',32);},
    async pilotMembers(org){return pilotQuery(`ORG#${org}`,'MEMBER#',25);},
    async plan(org){return planFor((await get(metaKey(org)))?.planId);},
    async memberCount(org){return (await ensureMemberCounter(org)).memberCount;},
    async profile(subject){return (await get(profileKey(subject)))?.profile;},
    async initialize(subject,email,initial){
      if(initial.length>32) throw new HttpError(503,'MIGRATION_REQUIRED','La migración inicial necesita revisión del administrador.');
      const profile={subject,email,defaultOrganizationId:initial[0]?.organizationId ?? null};
      const actions=[put(profileKey(subject),{profile})];
      for(const input of initial) {
        const member={...input,subject,email};
        await ensureMemberCounter(member.organizationId);
        // Historical migration must retain access even above the default quota.
        actions.push(put(userKey(subject,member.organizationId),{member}),put(orgKey(member.organizationId,subject),{member}),counter(member.organizationId,member.role==='admin' ? 1 : 0,false,1));
      }
      try {await transaction(actions);return true;}
      catch(error) {
        if(error.name!=='TransactionCanceledException') throw error;
        if(await repository.profile(subject)) return false;
        throw membershipConflict();
      }
    },
    async memberships(subject){return query(`USER#${subject}`,'ORG#','member');},
    async member(org,subject){return (await get(userKey(subject,org)))?.member;},
    async members(org){return query(`ORG#${org}`,'MEMBER#','member');},
    async createInvitation(invitation){
      const meta=await ensureMemberCounter(invitation.organizationId);
      const plan=await repository.plan(invitation.organizationId);
      const metric=usageMetric(meta.memberCount,plan.limits.members);
      if(!metric.remaining && !(await repository.members(invitation.organizationId)).some(member=>member.email===invitation.email)) throw quotaExceeded(metric);
      try {await transaction([put(inviteKey(invitation.tokenHash),{invitation}),caller(invitation.organizationId,invitation.createdBy)]);return invitation;}
      catch(error) {if(error.name!=='TransactionCanceledException') throw error;if((await repository.member(invitation.organizationId,invitation.createdBy))?.role!=='admin') throw noAccess();throw membershipConflict();}
    },
    async invitation(hash){return (await get(inviteKey(hash)))?.invitation;},
    async acceptInvitation(hash,subject,email,now,retried=false){
      const invitation=invitationForRecipient(await repository.invitation(hash),subject,email,now);
      const existing=await repository.member(invitation.organizationId,subject);
      if(invitation.acceptedBy) {
        if(!existing) throw new HttpError(409,'INVITATION_ALREADY_USED','Esta invitación ya se utilizó y la membresía fue retirada.');
        return existing;
      }
      const member=existing ?? {subject,organizationId:invitation.organizationId,role:invitation.role,email,joinedAt:now.toISOString()};
      const next={...invitation,acceptedBy:subject,acceptedAt:now.toISOString()};
      const actions=[put(inviteKey(hash),{invitation:next},'attribute_not_exists(#invitation.acceptedBy) AND #invitation.email = :email AND #invitation.expiresAt > :now',{ExpressionAttributeNames:{'#invitation':'invitation'},ExpressionAttributeValues:{':email':email,':now':now.toISOString()}})];
      if(existing) actions.push({ConditionCheck:{TableName:table,Key:userKey(subject,member.organizationId),ConditionExpression:'#member.#role = :role',ExpressionAttributeNames:roleNames,ExpressionAttributeValues:{':role':existing.role}}});
      else {
        const meta=await ensureMemberCounter(member.organizationId);
        const plan=await repository.plan(member.organizationId);
        const metric=usageMetric(meta.memberCount,plan.limits.members);
        if(!metric.remaining) throw quotaExceeded(metric);
        actions.push(put(userKey(subject,member.organizationId),{member}),put(orgKey(member.organizationId,subject),{member}),counter(member.organizationId,member.role==='admin' ? 1 : 0,false,1,plan.limits.members,plan.id));
      }
      try {await transaction(actions);return member;}
      catch(error) {if(error.name!=='TransactionCanceledException') throw error;if(!retried) return repository.acceptInvitation(hash,subject,email,now,true);throw membershipConflict();}
    },
    async changeRole(org,actor,subject,role){
      const existing=await repository.member(org,subject);if(!existing) throw notFound();
      if((await repository.member(org,actor))?.role!=='admin') throw noAccess();
      if(existing.role===role) return existing;
      const member={...existing,role};const condition='#member.#role = :oldRole';const extra={ExpressionAttributeNames:roleNames,ExpressionAttributeValues:{':oldRole':existing.role}};
      const actions=[put(userKey(subject,org),{member},condition,extra),put(orgKey(org,subject),{member},condition,extra)];
      if(actor!==subject) actions.push(caller(org,actor));
      if(existing.role==='admin') actions.push(counter(org,-1,true));
      else if(role==='admin') actions.push(counter(org,1));
      try {await transaction(actions);return member;}
      catch(error) {if(error.name!=='TransactionCanceledException') throw error;await explainMutationConflict(org,actor,existing,role!=='admin');}
    },
    async removeMember(org,actor,subject){
      const existing=await repository.member(org,subject);if(!existing) throw notFound();
      if((await repository.member(org,actor))?.role!=='admin') throw noAccess();
      await ensureMemberCounter(org);
      const actions=[userKey(subject,org),orgKey(org,subject)].map(Key=>({Delete:{TableName:table,Key,ConditionExpression:'#member.#role = :oldRole',ExpressionAttributeNames:roleNames,ExpressionAttributeValues:{':oldRole':existing.role}}}));
      if(actor!==subject) actions.push(caller(org,actor));
      actions.push(counter(org,existing.role==='admin' ? -1 : 0,existing.role==='admin',-1));
      try {await transaction(actions);}
      catch(error) {if(error.name!=='TransactionCanceledException') throw error;await explainMutationConflict(org,actor,existing,true);}
    },
  };
  async function explainMutationConflict(org,actor,existing,losesAdmin){
    if((await repository.member(org,actor))?.role!=='admin') throw noAccess();
    if(existing.role==='admin' && losesAdmin && ((await get(metaKey(org)))?.adminCount ?? 0)<=1) throw lastAdmin();
    throw membershipConflict();
  }
  return repository;
}
