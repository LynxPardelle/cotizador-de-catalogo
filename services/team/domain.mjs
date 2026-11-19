import { createHash } from 'node:crypto';
import { HttpError, badRequest, notFound } from '../shared/errors.mjs';
export const roles=['admin','seller','reader'];
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export const ownOrganization=(pool,sub)=>`org-${createHash('sha256').update(`${pool}:${sub.toLowerCase()}`).digest('hex').slice(0,32)}`;
export const noAccess=()=>new HttpError(403,'MEMBERSHIP_REQUIRED','Tu cuenta no tiene acceso a este espacio de trabajo.');
export const lastAdmin=()=>new HttpError(409,'LAST_ADMIN','Conserva al menos una persona administradora en este espacio de trabajo.');
export const membershipConflict=()=>new HttpError(409,'MEMBERSHIP_CONFLICT','La membresía cambió durante la operación. Actualiza el equipo y vuelve a intentarlo.');
export function subjectId(value) {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw badRequest('El identificador de persona no es válido.');
  return value;
}
export function normalizeEmail(value) {
  if(typeof value!=='string' || value.length>254) throw badRequest('Introduce un correo válido para la invitación.');
  const email=value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Introduce un correo válido para la invitación.');
  return email;
}
export function invitationForRecipient(invitation,subject,email,now) {
  if(!invitation || invitation.email!==email || (invitation.acceptedBy && invitation.acceptedBy!==subject)) throw notFound();
  if(!invitation.acceptedBy && Date.parse(invitation.expiresAt)<=now.getTime()) throw new HttpError(410,'INVITATION_EXPIRED','Esta invitación ha caducado. Solicita un enlace nuevo.');
  return invitation;
}
export function invitationView(invitation) {
  return {organizationId:invitation.organizationId,email:invitation.email,role:invitation.role,expiresAt:invitation.expiresAt,accepted:!!invitation.acceptedBy};
}
