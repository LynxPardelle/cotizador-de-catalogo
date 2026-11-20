import {CognitoIdentityProviderClient,AdminGetUserCommand} from '@aws-sdk/client-cognito-identity-provider';
import {accessSubject} from '../shared/auth.mjs';
import {HttpError} from '../shared/errors.mjs';
const denied=()=>new HttpError(403,'FORBIDDEN','Inicia sesión con una cuenta habilitada, confirmada y con correo verificado.');
export function createPreparationIdentity({client=new CognitoIdentityProviderClient({}),userPoolId=process.env.APPLICATIONS_USER_POOL_ID}={}){
 if(!userPoolId)throw new Error('Missing preparation user pool configuration');
 return async event=>{
  const subject=accessSubject(event);let user;try{user=await client.send(new AdminGetUserCommand({UserPoolId:userPoolId,Username:subject}));}catch(error){if(error.name==='UserNotFoundException')throw denied();throw error;}
  const attrs=Object.fromEntries((user.UserAttributes??[]).map(value=>[value.Name,value.Value]));if(!user.Enabled||user.UserStatus!=='CONFIRMED'||attrs.sub!==subject||attrs.email_verified!=='true'||typeof attrs.email!=='string'||attrs.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attrs.email.trim()))throw denied();return {subject,email:attrs.email.trim().toLowerCase()};
 };
}
