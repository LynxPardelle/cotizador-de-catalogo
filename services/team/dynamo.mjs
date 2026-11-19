import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { HttpError, notFound } from '../shared/errors.mjs';
import { noAccess, lastAdmin, membershipConflict, invitationForRecipient } from './domain.mjs';

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
  const counter=(org,delta,last=false)=>({Update:{TableName:table,Key:metaKey(org),UpdateExpression:'ADD adminCount :delta',...(last ? {ConditionExpression:'adminCount > :one'} : {}),ExpressionAttributeValues:{':delta':delta,...(last ? {':one':1} : {})}}});
  const transaction=TransactItems=>client.send(new TransactWriteCommand({TransactItems}));
  async function query(PK,prefix,field) {
    const results=[];let ExclusiveStartKey;
    do {
      const page=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':PK,':prefix':prefix},ConsistentRead:true,ExclusiveStartKey}));
      results.push(...(page.Items ?? []).map(item=>item[field]));ExclusiveStartKey=page.LastEvaluatedKey;
    } while(ExclusiveStartKey);
    return results;
  }
  const repository={
    async profile(subject){return (await get(profileKey(subject)))?.profile;},
    async initialize(subject,email,initial){
      if(initial.length>32) throw new HttpError(503,'MIGRATION_REQUIRED','La migración inicial necesita revisión del administrador.');
      const profile={subject,email,defaultOrganizationId:initial[0]?.organizationId ?? null};
      const actions=[put(profileKey(subject),{profile})];
      for(const input of initial) {
        const member={...input,subject,email};
        actions.push(put(userKey(subject,member.organizationId),{member}),put(orgKey(member.organizationId,subject),{member}),counter(member.organizationId,member.role==='admin' ? 1 : 0));
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
      else actions.push(put(userKey(subject,member.organizationId),{member}),put(orgKey(member.organizationId,subject),{member}),counter(member.organizationId,member.role==='admin' ? 1 : 0));
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
      const actions=[userKey(subject,org),orgKey(org,subject)].map(Key=>({Delete:{TableName:table,Key,ConditionExpression:'#member.#role = :oldRole',ExpressionAttributeNames:roleNames,ExpressionAttributeValues:{':oldRole':existing.role}}}));
      if(actor!==subject) actions.push(caller(org,actor));
      if(existing.role==='admin') actions.push(counter(org,-1,true));
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
