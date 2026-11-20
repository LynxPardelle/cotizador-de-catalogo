import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {developmentResources} from './plan-development.mjs';
import {validUuid} from '../services/shared/http.mjs';
const require=createRequire(new URL('../services/package.json',import.meta.url));
export const REVIEWER_GROUP='cotitrama-pilot-reviewers';
export function validateReviewerContext(context){
 assert.equal(context?.stackName,'cotitrama-development');assert.equal(context?.region,'us-east-1');assert.equal(context?.outputs?.PublicUrl,'https://cotitrama-dev.lynxpardelle.com');assert.match(context?.outputs?.UserPoolId??'',/^us-east-1_[A-Za-z0-9]+$/);return context;
}
export function reviewerTarget(email,user,grant){
 assert.ok(typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));const attrs=Object.fromEntries((user?.UserAttributes??[]).map(x=>[x.Name,x.Value]));
 assert.equal(attrs.email?.trim().toLowerCase(),email.trim().toLowerCase(),'The requested account must match its current email.');assert.ok(validUuid(attrs.sub)&&typeof user.Username==='string'&&user.Username.length>0);
 if(grant){assert.equal(user.Enabled,true,'The target must be enabled.');assert.equal(user.UserStatus,'CONFIRMED','The target must be confirmed.');assert.equal(attrs.email_verified,'true','The target email must be verified.');}
 return {username:user.Username,subject:attrs.sub};
}
export async function reviewerAccess(context,email,operation,{client}={}){
 validateReviewerContext(context);assert.ok(['show','grant','revoke'].includes(operation));
 const cs=require('@aws-sdk/client-cognito-identity-provider');const own=!client;client??=new cs.CognitoIdentityProviderClient({region:context.region});
 try{
  const group=(await client.send(new cs.GetGroupCommand({UserPoolId:context.outputs.UserPoolId,GroupName:REVIEWER_GROUP}))).Group;assert.equal(group?.GroupName,REVIEWER_GROUP,'The stack reviewer group must already exist.');
  const user=await client.send(new cs.AdminGetUserCommand({UserPoolId:context.outputs.UserPoolId,Username:email}));const target=reviewerTarget(email,user,operation==='grant');
  if(operation!=='show')await client.send(new (operation==='grant'?cs.AdminAddUserToGroupCommand:cs.AdminRemoveUserFromGroupCommand)({UserPoolId:context.outputs.UserPoolId,Username:target.username,GroupName:REVIEWER_GROUP}));
  let NextToken,pages=0;const groups=[];
  do{assert.ok(pages++<10,'The group lookup exceeded its budget.');const page=await client.send(new cs.AdminListGroupsForUserCommand({UserPoolId:context.outputs.UserPoolId,Username:target.username,Limit:60,NextToken}));groups.push(...(page.Groups??[]).map(x=>x.GroupName));NextToken=page.NextToken;}while(NextToken);
  const reviewer=groups.includes(REVIEWER_GROUP);if(operation!=='show')assert.equal(reviewer,operation==='grant','The reviewer assignment could not be verified.');
  return {reviewer,enabled:user.Enabled===true,emailVerified:(user.UserAttributes??[]).some(x=>x.Name==='email_verified'&&x.Value==='true'),operation,group:REVIEWER_GROUP};
 }finally{if(own)client.destroy();}
}
export async function main(args=process.argv.slice(2)){
 assert.ok(args.length===2&&['--show','--grant','--revoke'].includes(args[0]),'Use --show, --grant or --revoke with the exact account email.');const context=await developmentResources();const result=await reviewerAccess(context,args[1],args[0].slice(2));console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(`CotiTrama reviewer operation failed (${error?.name??'Error'}); no account details printed.`);process.exitCode=1;});
