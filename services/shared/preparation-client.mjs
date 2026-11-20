import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import {HttpError} from './errors.mjs';
import {validId,validUuid} from './http.mjs';

const unavailable=()=>new HttpError(503,'PREPARATION_UNAVAILABLE','No pudimos comprobar los requisitos del piloto.');
const forbidden=()=>new HttpError(403,'MEMBERSHIP_REQUIRED','La cuenta no tiene acceso administrativo vigente.');
const falseReadiness=()=>({adminReady:false,sellerReady:false,verifiedMembers:0});
export function createPreparationServices({client=new LambdaClient({}),functionName=process.env.TEAM_FUNCTION_NAME,catalogFunctionName=process.env.CATALOG_FUNCTION_NAME}={}){
 if(!functionName||!catalogFunctionName)throw new Error('Missing preparation service configuration');
 async function invoke(FunctionName,payload){
  let result;try{result=await client.send(new InvokeCommand({FunctionName,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify(payload))}));}catch{throw unavailable();}
  if(result.FunctionError||!result.Payload)throw unavailable();
  let value;try{value=JSON.parse(Buffer.from(result.Payload).toString('utf8'));}catch{throw unavailable();}
  if(value?.error){if(value.error.statusCode===403)throw forbidden();throw unavailable();}return value;
 }
 const identity=(subject,workspaceId)=>{if(!validUuid(subject)||(workspaceId!==undefined&&!validId(workspaceId)))throw unavailable();};
 return {
  async workspaces(subject){
   identity(subject);const result=await invoke(functionName,{operation:'pilotAdminWorkspaces',subject});
   if(!Array.isArray(result)||result.length>32||result.some(value=>!validId(value?.workspaceId)||typeof value.label!=='string'||value.label.length>100)||new Set(result.map(value=>value.workspaceId)).size!==result.length)throw unavailable();
   return result.map(value=>({workspaceId:value.workspaceId,label:value.label}));
  },
  async access(subject,workspaceId){
   identity(subject,workspaceId);let result;
   try{result=await invoke(functionName,{operation:'pilotReadiness',subject,organizationId:workspaceId});}catch(error){if(error instanceof HttpError&&error.statusCode===403)return falseReadiness();throw error;}
   if(typeof result?.adminReady!=='boolean'||typeof result.sellerReady!=='boolean'||!Number.isSafeInteger(result.verifiedMembers)||result.verifiedMembers<0||result.verifiedMembers>25||(result.adminReady&&result.verifiedMembers<1)||(result.sellerReady&&(!result.adminReady||result.verifiedMembers<2)))throw unavailable();
   return {adminReady:result.adminReady,sellerReady:result.sellerReady,verifiedMembers:result.verifiedMembers};
  },
  async catalog(workspaceId,catalogId,version){
   if(!validId(workspaceId)||!validId(catalogId)||!Number.isSafeInteger(version)||version<1||version>999999999)throw unavailable();
   const result=await invoke(catalogFunctionName,{operation:'getPublishedCatalog',organizationId:workspaceId,catalogId,version});if(result===null)return null;
   if(result?.catalogId!==catalogId||result.version!==version||typeof result.name!=='string'||!result.name.trim()||result.name.length>120||typeof result.validUntil!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(result.validUntil)||!Number.isFinite(Date.parse(result.validUntil))||!Array.isArray(result.products)||result.products.length<1||result.products.length>100)throw unavailable();
   if(new Date(result.validUntil).toISOString()!==(result.validUntil.includes('.')?result.validUntil:result.validUntil.replace('Z','.000Z')))throw unavailable();
   if(Date.now()>=Date.parse(result.validUntil))return null;
   return {catalogId,version,name:result.name,validUntil:result.validUntil,productCount:result.products.length};
  },
 };
}
