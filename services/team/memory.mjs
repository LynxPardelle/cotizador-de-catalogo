import { HttpError, notFound } from '../shared/errors.mjs';
import { noAccess, lastAdmin, invitationForRecipient } from './domain.mjs';
import { planFor, usageMetric, quotaExceeded } from '../shared/quota.mjs';

export function createMemoryTeamRepository({plans={}}={}) {
  const profiles=new Map();const memberships=new Map();const invitations=new Map();
  const key=(org,sub)=>`${org}/${sub}`;
  const copy=value=>value===undefined ? undefined : structuredClone(value);
  const allMembers=org=>[...memberships.values()].filter(member=>member.organizationId===org);
  const admin=(org,sub)=>{if(memberships.get(key(org,sub))?.role!=='admin') throw noAccess();};
  const removable=(org,member)=>{if(member.role==='admin' && allMembers(org).filter(member=>member.role==='admin').length<=1) throw lastAdmin();};
  const plan=org=>planFor(plans[org]);
  const capacity=org=>{const metric=usageMetric(allMembers(org).length,plan(org).limits.members);if(!metric.remaining) throw quotaExceeded(metric);};
  return {
    async plan(org){return plan(org);},
    async memberCount(org){return allMembers(org).length;},
    async profile(sub){return copy(profiles.get(sub));},
    async initialize(sub,email,initial){
      if(profiles.has(sub)) return false;
      for(const member of initial) memberships.set(key(member.organizationId,sub),copy({...member,subject:sub,email}));
      profiles.set(sub,{subject:sub,email,defaultOrganizationId:initial[0]?.organizationId ?? null});return true;
    },
    async memberships(sub){return copy([...memberships.values()].filter(member=>member.subject===sub).sort((a,b)=>a.organizationId.localeCompare(b.organizationId)));},
    async member(org,sub){return copy(memberships.get(key(org,sub)));},
    async members(org){return copy(allMembers(org).sort((a,b)=>a.subject.localeCompare(b.subject)));},
    async createInvitation(invitation){
      admin(invitation.organizationId,invitation.createdBy);
      if(!allMembers(invitation.organizationId).some(member=>member.email===invitation.email)) capacity(invitation.organizationId);
      if(invitations.has(invitation.tokenHash)) throw new HttpError(409,'INVITATION_CONFLICT','No se pudo crear un enlace único. Vuelve a intentarlo.');
      invitations.set(invitation.tokenHash,copy(invitation));return copy(invitation);
    },
    async invitation(hash){return copy(invitations.get(hash));},
    async acceptInvitation(hash,sub,email,now){
      const invitation=invitationForRecipient(invitations.get(hash),sub,email,now);
      const existing=memberships.get(key(invitation.organizationId,sub));
      if(invitation.acceptedBy) {
        if(!existing) throw new HttpError(409,'INVITATION_ALREADY_USED','Esta invitación ya se utilizó y la membresía fue retirada.');
        return copy(existing);
      }
      if(!existing) capacity(invitation.organizationId);
      const member=existing ?? {subject:sub,organizationId:invitation.organizationId,role:invitation.role,email,joinedAt:now.toISOString()};
      memberships.set(key(invitation.organizationId,sub),member);
      invitation.acceptedBy=sub;invitation.acceptedAt=now.toISOString();return copy(member);
    },
    async changeRole(org,actor,sub,role){
      admin(org,actor);const member=memberships.get(key(org,sub));if(!member) throw notFound();
      if(member.role==='admin' && role!=='admin') removable(org,member);
      member.role=role;return copy(member);
    },
    async removeMember(org,actor,sub){
      admin(org,actor);const member=memberships.get(key(org,sub));if(!member) throw notFound();
      removable(org,member);memberships.delete(key(org,sub));
    },
  };
}
