import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { noAccess } from './domain.mjs';

export function createCognitoUsers({client=new CognitoIdentityProviderClient({}),userPoolId=process.env.TEAM_USER_POOL_ID}={}) {
  if(!userPoolId) throw new Error('Missing team user pool configuration');
  return {
    async get(subject){
      let result;
      try {result=await client.send(new AdminGetUserCommand({UserPoolId:userPoolId,Username:subject}));}
      catch(error) {if(error.name==='UserNotFoundException') throw noAccess();throw error;}
      const attributes=Object.fromEntries((result.UserAttributes ?? []).map(attribute=>[attribute.Name,attribute.Value]));
      if(attributes.sub!==subject || !result.Enabled) throw noAccess();
      return {subject,email:attributes.email,emailVerified:attributes.email_verified==='true'};
    },
    async groups(subject){
      const names=[];let NextToken;
      do {const page=await client.send(new AdminListGroupsForUserCommand({UserPoolId:userPoolId,Username:subject,NextToken,Limit:60}));names.push(...(page.Groups ?? []).map(group=>group.GroupName));NextToken=page.NextToken;} while(NextToken);
      return names;
    },
  };
}
