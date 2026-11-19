import { createHash } from 'node:crypto';
import {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

function isVerifiedSignup(event) {
  const attributes=event?.request?.userAttributes;
  return event?.triggerSource==='PostConfirmation_ConfirmSignUp'
    && typeof event.userPoolId==='string' && event.userPoolId.length<=55 && /^[\w-]+_[0-9a-zA-Z]+$/.test(event.userPoolId)
    && typeof event.userName==='string' && event.userName.length>=1 && event.userName.length<=128 && /^[\p{L}\p{M}\p{S}\p{N}\p{P}]+$/u.test(event.userName)
    && typeof attributes?.sub==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attributes.sub)
    && attributes.email_verified==='true';
}

export function createOnboardingHandler({client=new CognitoIdentityProviderClient({maxAttempts:2})}={}) {
  return async event=>{
    if(event?.triggerSource==='PostConfirmation_ConfirmForgotPassword') return event;
    if(!isVerifiedSignup(event)) throw new Error('Invalid verified signup event.');

    // Neither ClientMetadata nor custom user attributes can choose a tenant or role.
    // Stable 128-bit identity also makes retries after partial provisioning safe.
    const digest=createHash('sha256').update(`${event.userPoolId}:${event.request.userAttributes.sub.toLowerCase()}`).digest('hex').slice(0,32);
    const GroupName=`org:org-${digest}:admin`;
    const UserPoolId=event.userPoolId;
    try {
      try { await client.send(new CreateGroupCommand({UserPoolId,GroupName})); }
      catch(error) { if(error?.name!=='GroupExistsException') throw error; }
      await client.send(new AdminAddUserToGroupCommand({UserPoolId,Username:event.userName,GroupName}));
    } catch {
      // Lambda failures must never include SDK request details or personal attributes.
      throw new Error('Unable to provision organization membership.');
    }
    return event;
  };
}

export const handler=createOnboardingHandler();
