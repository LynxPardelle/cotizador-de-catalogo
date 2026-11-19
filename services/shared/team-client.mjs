import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { accessSubject } from './auth.mjs';
import { HttpError } from './errors.mjs';
import { requireId } from './http.mjs';
import { planFor } from './quota.mjs';

const unavailable=()=>new HttpError(503,'TEAM_UNAVAILABLE','No pudimos validar tu espacio de trabajo. Intenta de nuevo.');
export function createTeamAuthorizer({client=new LambdaClient({}),functionName=process.env.TEAM_FUNCTION_NAME}={}) {
  if(!functionName) throw new Error('Missing Team service function configuration');
  return async event=>{
    const subject=accessSubject(event);
    const selected=Object.entries(event.headers ?? {}).find(([name])=>name.toLowerCase()==='x-organization-id')?.[1];
    if(selected!==undefined) requireId(selected);
    let result;
    try {result=await client.send(new InvokeCommand({FunctionName:functionName,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify({operation:'authorizeMembership',subject,...(selected ? {organizationId:selected} : {})}))}));}
    catch {throw unavailable();}
    if(result.FunctionError || !result.Payload) throw unavailable();
    let user;try {user=JSON.parse(Buffer.from(result.Payload).toString('utf8'));} catch {throw unavailable();}
    if(user?.error && Number.isInteger(user.error.statusCode) && user.error.statusCode>=400 && user.error.statusCode<500) throw new HttpError(user.error.statusCode,user.error.code,user.error.message);
    if(user?.subject!==subject || typeof user?.organizationId!=='string' || !['admin','seller','reader'].includes(user?.role) || (selected && user.organizationId!==selected)) throw unavailable();
    let plan;
    try {
      if(!user.plan || typeof user.plan.id!=='string') throw unavailable();
      plan=planFor(user.plan.id);
      if(user.plan.name!==plan.name || !user.plan.limits || Object.keys(user.plan.limits).length!==Object.keys(plan.limits).length || Object.entries(plan.limits).some(([key,value])=>user.plan.limits[key]!==value)) throw unavailable();
    } catch {throw unavailable();}
    user.plan=plan;
    return user;
  };
}
