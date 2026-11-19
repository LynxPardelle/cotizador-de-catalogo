import { randomBytes } from 'node:crypto';
import { accessSubject, requireRole } from '../shared/auth.mjs';
import { HttpError, badRequest, notFound } from '../shared/errors.mjs';
import { httpHandler, jsonBody, requireId, response } from '../shared/http.mjs';
import { roles, subjectId, normalizeEmail, noAccess, hashToken, invitationForRecipient, invitationView, ownOrganization } from './domain.mjs';

export function createTeamHandler({repository,users,clock=()=>new Date(),newToken=()=>randomBytes(32).toString('base64url'),userPoolId}={}) {
  async function verifiedUser(subject) {
    const user=await users.get(subject);
    if(!user || !user.emailVerified) throw new HttpError(403,'EMAIL_NOT_VERIFIED','Verifica tu correo antes de administrar o aceptar invitaciones.');
    return {...user,email:normalizeEmail(user.email)};
  }
  async function ensureInitialized(subject) {
    if(await repository.profile(subject)) return;
    const user=await verifiedUser(subject);
    const groups=await users.groups(subject);
    const legacy=new Map();const rank={reader:1,seller:2,admin:3};
    for(const group of groups) {
      const match=/^org:([a-zA-Z0-9_-]{1,64}):(admin|seller|reader)$/.exec(group);
      if(match && (!legacy.has(match[1]) || rank[legacy.get(match[1]).role]<rank[match[2]])) legacy.set(match[1],{subject,organizationId:match[1],role:match[2],email:user.email,joinedAt:clock().toISOString()});
    }
    const initial=[...legacy.values()].sort((a,b)=>a.organizationId.localeCompare(b.organizationId));
    const own=userPoolId ? ownOrganization(userPoolId,subject) : undefined;
    initial.sort((a,b)=>a.organizationId===own ? -1 : b.organizationId===own ? 1 : 0);
    await repository.initialize(subject,user.email,initial);
  }
  async function context(subject,selected,recoverSelection=false) {
    subjectId(subject);if(selected!==undefined) requireId(selected);
    await ensureInitialized(subject);
    const [memberships,profile]=await Promise.all([repository.memberships(subject),repository.profile(subject)]);
    if(selected && !memberships.some(member=>member.organizationId===selected)) {if(recoverSelection) selected=undefined;else throw noAccess();}
    const defaultId=profile?.defaultOrganizationId;
    const activeOrganizationId=selected ?? (memberships.some(member=>member.organizationId===defaultId) ? defaultId : memberships[0]?.organizationId ?? null);
    return {memberships,activeOrganizationId};
  }
  async function authorize(subject,selected) {
    const current=await context(subject,selected);
    const member=current.memberships.find(member=>member.organizationId===current.activeOrganizationId);
    if(!member) throw noAccess();
    return {subject,organizationId:member.organizationId,role:member.role};
  }
  const publicHandler=httpHandler(async(event,correlationId)=>{
    const subject=subjectId(accessSubject(event));
    const selected=Object.entries(event.headers ?? {}).find(([name])=>name.toLowerCase()==='x-organization-id')?.[1];
    const path=event.rawPath;const method=event.requestContext?.http?.method;
    if(method==='GET' && path==='/api/v1/team/context') return response(200,await context(subject,selected,true),correlationId);
    const invitePath=/^\/api\/v1\/team\/invitations\/([A-Za-z0-9_-]{43})(\/accept)?$/.exec(path);
    if(invitePath && ((method==='GET' && !invitePath[2]) || (method==='POST' && invitePath[2]))) {
      const user=await verifiedUser(subject);await ensureInitialized(subject);
      const tokenHash=hashToken(invitePath[1]);const now=clock();
      const invitation=invitationForRecipient(await repository.invitation(tokenHash),subject,user.email,now);
      if(method==='GET') return response(200,{invitation:invitationView(invitation)},correlationId);
      const body=jsonBody(event);if(Object.keys(body).length) throw badRequest('La aceptación no recibe datos adicionales.');
      const membership=await repository.acceptInvitation(tokenHash,subject,user.email,now);
      return response(200,{membership},correlationId);
    }
    const user=await authorize(subject,selected);requireRole(user,['admin']);
    if(method==='GET' && path==='/api/v1/team/members') return response(200,{members:await repository.members(user.organizationId)},correlationId);
    if(method==='POST' && path==='/api/v1/team/invitations') {
      const body=jsonBody(event);
      if(Object.keys(body).some(key=>!['email','role'].includes(key)) || !roles.includes(body.role)) throw badRequest('Selecciona un rol válido para la invitación.');
      const token=newToken();if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid invitation entropy source');
      const now=clock();const invitation={tokenHash:hashToken(token),organizationId:user.organizationId,email:normalizeEmail(body.email),role:body.role,createdBy:subject,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+7*86400000).toISOString()};
      await repository.createInvitation(invitation);
      return response(201,{invitation:invitationView(invitation),token},correlationId);
    }
    const memberPath=/^\/api\/v1\/team\/members\/([^/]+)$/.exec(path);
    if(memberPath && method==='PATCH') {
      const body=jsonBody(event);if(Object.keys(body).length!==1 || !roles.includes(body.role)) throw badRequest('Selecciona un rol válido.');
      const member=await repository.changeRole(user.organizationId,subject,subjectId(memberPath[1]),body.role);
      return response(200,{member},correlationId);
    }
    if(memberPath && method==='DELETE') {await repository.removeMember(user.organizationId,subject,subjectId(memberPath[1]));return {statusCode:204,headers:{'cache-control':'no-store','x-correlation-id':correlationId},body:''};}
    throw notFound();
  });
  return async event=>{
    if(!event?.requestContext && event?.operation==='authorizeMembership') {
      try {return await authorize(subjectId(event.subject),event.organizationId);}
      catch(error) {if(error instanceof HttpError) return {error:{statusCode:error.statusCode,code:error.code,message:error.message}};throw error;}
    }
    return publicHandler(event);
  };
}

let configured;
export async function handler(event) {
  configured ??= Promise.all([import('./dynamo.mjs'),import('./cognito.mjs')]).then(([{createDynamoTeamRepository},{createCognitoUsers}])=>createTeamHandler({repository:createDynamoTeamRepository(),users:createCognitoUsers(),userPoolId:process.env.TEAM_USER_POOL_ID}));
  return (await configured)(event);
}
