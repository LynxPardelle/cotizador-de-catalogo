import {CognitoIdentityProviderClient,AdminGetUserCommand,AdminListGroupsForUserCommand} from '@aws-sdk/client-cognito-identity-provider';
import {accessSubject} from '../shared/auth.mjs';
import {HttpError} from '../shared/errors.mjs';
export const reviewerGroup='cotitrama-pilot-reviewers';
const denied=()=>new HttpError(403,'FORBIDDEN','Tu cuenta no tiene permiso para gestionar las solicitudes del piloto.');
export function createReviewerAuthorizer({client=new CognitoIdentityProviderClient({}),userPoolId=process.env.APPLICATIONS_USER_POOL_ID}={}){
 if(!userPoolId)throw new Error('Missing applications user pool configuration');
 return async event=>{
  const subject=accessSubject(event);let user;
  try{user=await client.send(new AdminGetUserCommand({UserPoolId:userPoolId,Username:subject}));}catch(error){if(error.name==='UserNotFoundException')throw denied();throw error;}
  const attributes=Object.fromEntries((user.UserAttributes??[]).map(value=>[value.Name,value.Value]));if(!user.Enabled||user.UserStatus!=='CONFIRMED'||attributes.sub!==subject||attributes.email_verified!=='true')throw denied();
  let NextToken;
  for(let page=0;page<10;page++){
   const result=await client.send(new AdminListGroupsForUserCommand({UserPoolId:userPoolId,Username:subject,NextToken,Limit:60}));
   if((result.Groups??[]).some(value=>value.GroupName===reviewerGroup))return {subject};
   NextToken=result.NextToken;if(!NextToken)throw denied();
  }
  throw new HttpError(503,'REVIEWER_UNAVAILABLE','No pudimos comprobar el acceso de operador. Vuelve a intentarlo.');
 };
}
