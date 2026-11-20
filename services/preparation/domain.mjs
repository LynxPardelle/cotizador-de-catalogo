import contract from './contract.json' with {type:'json'};
import {badRequest,HttpError,notFound} from '../shared/errors.mjs';
import {validUuid,validId,hash,versionNumber} from '../shared/http.mjs';
import {applicationItem,initialReview,validDate,decodeCursor} from '../applications/domain.mjs';
export const agreementIds=contract.agreements.map(value=>value.id);
export const preparationConflict=()=>new HttpError(409,'PREPARATION_CONFLICT','Otra persona modificó la preparación. Recarga la versión vigente antes de guardar.');
export const preparationBusy=()=>new HttpError(503,'PREPARATION_BUSY','No pudimos confirmar la preparación. Reintenta la misma intención.');
export const alreadyLinked=()=>new HttpError(409,'WORKSPACE_ALREADY_LINKED','Esta solicitud ya tiene un espacio vinculado. No se cambia desde este formulario.');
export const catalogNotReady=()=>new HttpError(409,'CATALOG_NOT_READY','El catálogo debe estar publicado, activo, vigente y contener productos.');
export const forbidden=()=>new HttpError(403,'FORBIDDEN','Necesitas conservar el rol administrador del espacio vinculado.');
const unavailable=()=>new HttpError(503,'PREPARATION_UNAVAILABLE','No pudimos validar la preparación del piloto.');
export function selectedRoot(item,now){const root=applicationItem(item,now);if(!root)throw notFound();if(initialReview(root).status!=='selected')throw new HttpError(409,'PREPARATION_PAUSED','La solicitud debe seguir preseleccionada para preparar su incorporación.');return root;}
export function initialPreparation(root){
 const empty={version:0,workspaceId:null,linkedAt:null,catalog:null,agreements:Object.fromEntries(agreementIds.map(id=>[id,false])),plannedStartDate:'',updatedAt:root.createdAt};
 if(root.preparation===undefined)return empty;const p=root.preparation;
 if(!p||!Number.isSafeInteger(p.version)||p.version<1||p.version>999999999999||typeof p.updatedAt!=='string'||!Number.isFinite(Date.parse(p.updatedAt))||!validDate(p.plannedStartDate)||!validAgreements(p.agreements)||!(p.workspaceId===null||validId(p.workspaceId))||!(p.linkedAt===null||typeof p.linkedAt==='string'&&Number.isFinite(Date.parse(p.linkedAt)))||p.workspaceId&&(!validUuid(p.linkedSubject)||!p.linkedAt)||p.catalog!==null&&!validCatalogRef(p.catalog))throw unavailable();
 return structuredClone(p);
}
const validAgreements=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===agreementIds.length&&agreementIds.every(id=>typeof value[id]==='boolean');
const validCatalogRef=value=>!!value&&typeof value==='object'&&validId(value.catalogId)&&Number.isSafeInteger(value.version)&&value.version>=1&&value.version<=999999999;
export function preparationDto(preparation){return {...Object.fromEntries(['version','workspaceId','linkedAt','agreements','plannedStartDate','updatedAt'].map(key=>[key,structuredClone(preparation[key])])),catalog:preparation.catalog?{catalogId:preparation.catalog.catalogId,version:preparation.catalog.version}:null};}
function exact(body,keys){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==keys.length||Object.keys(body).some(key=>!keys.includes(key)))throw badRequest('Usa únicamente los campos previstos para la preparación.');}
function base(body,keys){exact(body,['mutationId','expectedVersion',...keys]);if(!validUuid(body.mutationId)||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||body.expectedVersion>=999999999999)throw badRequest('La referencia o versión de preparación no es válida.');return {...body,mutationId:body.mutationId.toLowerCase()};}
export function parseLink(body){const value=base(body,['workspaceId','participationConsent','sharingConsent','consentVersion']);if(!validId(value.workspaceId)||value.participationConsent!==true||value.sharingConsent!==true||value.consentVersion!==contract.consentVersion)throw badRequest('Selecciona un espacio y acepta expresamente la participación y la información compartida.');return value;}
export function parseCatalog(body){const value=base(body,['catalogId','version','catalogAuthorized','consentVersion']);if(!validId(value.catalogId)||value.catalogAuthorized!==true||value.consentVersion!==contract.consentVersion)throw badRequest('Autoriza el catálogo publicado y su uso para el piloto.');value.version=versionNumber(value.version);return value;}
export function parseAgreements(body){const value=base(body,['agreements','plannedStartDate']);if(!validAgreements(value.agreements)||!validDate(value.plannedStartDate)||value.plannedStartDate&&value.plannedStartDate<'0001-01-01')throw badRequest('Revisa los acuerdos y la fecha de calendario UTC.');return value;}
export function historyQuery(event,reference){const q=new URLSearchParams(event.rawQueryString??new URLSearchParams(event.queryStringParameters??{}));if([...q.keys()].some(key=>key!=='cursor'||q.getAll(key).length!==1))throw badRequest('La consulta del historial no es válida.');return {cursor:decodeCursor(q.get('cursor'),{kind:'preparation-history',reference})};}
export const mutationHash=(kind,input,subject)=>hash({kind,input,subject});
export function changedPreparation(root,kind,input,subject,now){
 const current=initialPreparation(root),result={...current,version:current.version+1,updatedAt:now.toISOString()};
 if(kind==='link'){if(current.workspaceId)throw alreadyLinked();Object.assign(result,{workspaceId:input.workspaceId,linkedSubject:subject,linkedAt:now.toISOString(),linkConsent:{participationConsent:true,sharingConsent:true,consentVersion:input.consentVersion,acceptedAt:now.toISOString()}});}
 else if(kind==='catalog'){if(!current.workspaceId||current.linkedSubject!==subject)throw forbidden();Object.assign(result,{catalog:{catalogId:input.catalogId,version:input.version},catalogConsent:{catalogAuthorized:true,consentVersion:input.consentVersion,acceptedAt:now.toISOString()}});}
 else if(kind==='agreements'){result.agreements=structuredClone(input.agreements);result.plannedStartDate=input.plannedStartDate;}
 else throw new Error('Unknown preparation mutation');return result;
}
export function historyEvent(preparation,kind,input,actorKey,now){return {mutationId:input.mutationId,version:preparation.version,kind,actorKey,createdAt:now.toISOString(),...(kind==='link'?{workspaceId:input.workspaceId,consentVersion:input.consentVersion}:kind==='catalog'?{catalog:{catalogId:input.catalogId,version:input.version},consentVersion:input.consentVersion}:{agreements:structuredClone(input.agreements),plannedStartDate:input.plannedStartDate})};}
export function historyDto(event){
 if(!event||!['link','catalog','agreements'].includes(event.kind))throw unavailable();const dto=Object.fromEntries(['mutationId','version','kind','actorKey','createdAt'].map(key=>[key,event[key]]));
 if(event.kind==='link')Object.assign(dto,{workspaceId:event.workspaceId,consentVersion:event.consentVersion});
 else if(event.kind==='catalog')Object.assign(dto,{catalog:{catalogId:event.catalog?.catalogId,version:event.catalog?.version},consentVersion:event.consentVersion});
 else Object.assign(dto,{agreements:Object.fromEntries(agreementIds.map(id=>[id,event.agreements?.[id]])),plannedStartDate:event.plannedStartDate});return dto;
}
export function catalogReady(value,reference,now){return !!value&&value.catalogId===reference?.catalogId&&value.version===reference.version&&typeof value.name==='string'&&typeof value.validUntil==='string'&&Number.isFinite(Date.parse(value.validUntil))&&Date.parse(value.validUntil)>now.getTime()&&Number.isSafeInteger(value.productCount)&&value.productCount>0;}
export async function readiness(preparation,services,now){
 const access=preparation.workspaceId?await services.access(preparation.linkedSubject,preparation.workspaceId):{adminReady:false,sellerReady:false,verifiedMembers:0};
 if(!access||typeof access.adminReady!=='boolean'||typeof access.sellerReady!=='boolean'||!Number.isSafeInteger(access.verifiedMembers)||access.verifiedMembers<0)throw unavailable();
 const current=access.adminReady&&preparation.workspaceId&&preparation.catalog?await services.catalog(preparation.workspaceId,preparation.catalog.catalogId,preparation.catalog.version):null;
 const ready=catalogReady(current,preparation.catalog,now),catalog={ready,...(current?Object.fromEntries(['catalogId','version','name','validUntil','productCount'].map(key=>[key,current[key]])):{})},pending=[];
 if(!preparation.workspaceId)pending.push('workspace');if(!access.adminReady)pending.push('admin_access');if(!access.sellerReady)pending.push('seller_access');if(!ready)pending.push('catalog');for(const id of agreementIds)if(!preparation.agreements[id])pending.push(id);if(!preparation.plannedStartDate||preparation.plannedStartDate<now.toISOString().slice(0,10))pending.push('planned_start_date');
 const state=!preparation.workspaceId?'awaiting_link':!access.adminReady||preparation.catalog&&!ready?'blocked':pending.length?'preparing':'ready';return {state,checkedAt:now.toISOString(),access,catalog,pending};
}
