import contract from './contract.json' with {type:'json'};
import {badRequest,HttpError,notFound} from '../shared/errors.mjs';
import {validUuid} from '../shared/http.mjs';
export const statuses=contract.statuses.map(value=>value.id);
export const reviewConflict=()=>new HttpError(409,'REVIEW_CONFLICT','Otra revisión modificó la solicitud. Consulta la versión actual antes de guardar.');
export const reviewBusy=()=>new HttpError(503,'REVIEW_BUSY','No pudimos confirmar el cambio. Reintenta con la misma referencia.');
const unavailable=()=>new HttpError(503,'APPLICATIONS_UNAVAILABLE','No pudimos validar el registro de la solicitud.');
export function requireReference(value){if(!validUuid(value))throw badRequest('La referencia de solicitud no es válida.');return value.toLowerCase();}
export const epoch=now=>{if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Invalid application clock');return Math.floor(now.getTime()/1000);};
export function validDate(value){return value===''||(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value);}
export function initialReview(item){
 if(item.review===undefined)return {status:'received',version:0,updatedAt:item.createdAt,nextActionDate:''};
 const value=item.review;
 if(!value||!statuses.includes(value.status)||!Number.isSafeInteger(value.version)||value.version<1||value.version>999999999999||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt))||!validDate(value.nextActionDate))throw unavailable();
 return {status:value.status,version:value.version,updatedAt:value.updatedAt,nextActionDate:value.nextActionDate};
}
export function applicationItem(item,now){
 if(!item||item.SK!=='RECORD'||!validUuid(item.reference)||item.PK!==`INTEREST#${item.reference}`||!Number.isSafeInteger(item.expiresAt)||item.expiresAt<=epoch(now))return undefined;
 if(!item.record||item.record.requestId!==item.reference||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt)))throw unavailable();
 return item;
}
export function summary(item,now){const valid=applicationItem(item,now);if(!valid)return undefined;return {reference:item.reference,organizationName:item.record.organizationName,sector:item.record.sector,createdAt:item.createdAt,expiresAt:item.expiresAt,review:initialReview(item)};}
export function detail(item,now){if(!applicationItem(item,now))throw notFound();return {reference:item.reference,application:structuredClone(item.record),review:initialReview(item)};}
export function parseUpdate(body){
 const allowed=['mutationId','expectedVersion','status','nextActionDate','note'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==allowed.length||Object.keys(body).some(key=>!allowed.includes(key)))throw badRequest('Usa únicamente los campos de seguimiento.');
 if(!validUuid(body.mutationId)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=999999999999||!statuses.includes(body.status)||!validDate(body.nextActionDate)||typeof body.note!=='string'||/[\p{Cf}\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u.test(body.note))throw badRequest('La revisión, el estado, la fecha o la nota no son válidos.');
 const note=body.note.trim().normalize('NFC');if(note.length>contract.maxNoteLength)throw badRequest('La nota debe tener hasta 500 caracteres.');
 return {mutationId:body.mutationId.toLowerCase(),expectedVersion:body.expectedVersion,status:body.status,nextActionDate:body.nextActionDate,note};
}
function query(event,allowed){const values=event.rawQueryString!==undefined?new URLSearchParams(event.rawQueryString):new URLSearchParams(event.queryStringParameters??{});for(const key of values.keys())if(!allowed.includes(key)||values.getAll(key).length!==1)throw badRequest('Los filtros de la consulta no son válidos.');return values;}
export function listQuery(event){const values=query(event,['status','cursor']);const status=values.get('status')??'all';if(status!=='all'&&!statuses.includes(status))throw badRequest('Selecciona un estado válido.');return {status,cursor:decodeCursor(values.get('cursor'),{kind:'list',status})};}
export function historyQuery(event,reference){const values=query(event,['cursor']);return {cursor:decodeCursor(values.get('cursor'),{kind:'history',reference})};}
export function noQuery(event){query(event,[]);}
function validKey(key){
 if(!key||typeof key!=='object'||Array.isArray(key)||Object.keys(key).length!==2||!Object.hasOwn(key,'PK')||!Object.hasOwn(key,'SK'))return false;
 if(/^DAILY#\d{4}-\d{2}-\d{2}$/.test(key.PK))return key.SK==='COUNTER';
 return typeof key.PK==='string'&&key.PK.startsWith('INTEREST#')&&validUuid(key.PK.slice(9))&&(key.SK==='RECORD'||/^(?:REVIEW|PREP_HISTORY)#\d{12}$/.test(key.SK)||typeof key.SK==='string'&&validUuid(/^(?:REPLAY|PREP_REPLAY)#(.+)$/.exec(key.SK)?.[1]));
}
export function encodeCursor(key,binding){if(!key)return null;if(!validKey(key))throw unavailable();return Buffer.from(JSON.stringify({v:1,...binding,key})).toString('base64url');}
export function decodeCursor(value,binding){
 if(value===null||value===undefined)return undefined;
 try{
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,2048}$/.test(value)||Buffer.from(value,'base64url').toString('base64url')!==value)throw new Error();
  const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));const expected=['v',...Object.keys(binding),'key'].sort();if(JSON.stringify(Object.keys(parsed).sort())!==JSON.stringify(expected)||parsed.v!==1||!validKey(parsed.key)||Object.entries(binding).some(([key,value])=>parsed[key]!==value))throw new Error();
  if(['history','preparation-history'].includes(binding.kind)&&(parsed.key.PK!==`INTEREST#${binding.reference}`||!(binding.kind==='history'?/^REVIEW#\d{12}$/:/^PREP_HISTORY#\d{12}$/).test(parsed.key.SK)))throw new Error();return parsed.key;
 }catch{throw badRequest('La continuación de la consulta no es válida.');}
}
export function historyEvent(previous,body,actorKey,createdAt){return {mutationId:body.mutationId,version:previous.version+1,previousStatus:previous.status,status:body.status,previousNextActionDate:previous.nextActionDate,nextActionDate:body.nextActionDate,note:body.note,actorKey,createdAt};}
