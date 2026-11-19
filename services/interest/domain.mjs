import contract from './contract.json' with {type:'json'};
import {badRequest,HttpError} from '../shared/errors.mjs';
import {validUuid} from '../shared/http.mjs';

const fields=['requestId','organizationName','contactEmail','sector','currentMethod','monthlyQuotes','twoParticipants','timeAvailability','contactConsent','privacyVersion'];
const control=/[\p{Cc}\p{Cf}]/u;
function text(value,max,label){
  if(typeof value!=='string'||control.test(value))throw badRequest(`${label} no es válido.`);
  const normalized=value.trim().normalize('NFC');
  if(normalized.length<2||normalized.length>max)throw badRequest(`${label} no es válido.`);
  return normalized;
}
const choice=(value,options)=>typeof value==='string'&&options.some(option=>option.id===value);
export function interestRequest(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==fields.length||Object.keys(body).some(key=>!fields.includes(key)))throw badRequest('Completa únicamente los campos del formulario.');
  if(!validUuid(body.requestId))throw badRequest('La referencia de solicitud no es válida.');
  const organizationName=text(body.organizationName,contract.limits.organizationName,'El nombre de la organización');
  const sector=text(body.sector,contract.limits.sector,'El sector');
  const contactEmail=text(body.contactEmail,contract.limits.contactEmail,'El correo').toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contactEmail))throw badRequest('Introduce un correo de contacto válido.');
  if(!choice(body.currentMethod,contract.currentMethods)||!choice(body.monthlyQuotes,contract.monthlyQuoteRanges)||!choice(body.twoParticipants,contract.availabilityOptions)||!choice(body.timeAvailability,contract.availabilityOptions))throw badRequest('Selecciona una opción válida en cada pregunta.');
  if(body.contactConsent!==true||body.privacyVersion!==contract.privacyVersion)throw badRequest('Confirma que podemos usar estos datos para contactarte sobre el piloto.');
  return {requestId:body.requestId.toLowerCase(),organizationName,contactEmail,sector,currentMethod:body.currentMethod,monthlyQuotes:body.monthlyQuotes,twoParticipants:body.twoParticipants,timeAvailability:body.timeAvailability,contactConsent:true,privacyVersion:contract.privacyVersion};
}
export function interestPeriod(now){
  const instant=now instanceof Date?now.getTime():NaN;
  if(!Number.isFinite(instant))throw new Error('Invalid interest clock');
  const nextDay=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
  return {day:now.toISOString().slice(0,10),expiresAt:Math.floor(nextDay/1000)+2*86400,retryAfter:Math.max(1,Math.ceil((nextDay-instant)/1000))};
}
export const interestLimit=()=>new HttpError(429,'INTEREST_LIMIT_REACHED','El formulario alcanzó su capacidad temporal. Vuelve a intentarlo después del reinicio diario UTC.');
export const interestBusy=()=>new HttpError(503,'INTEREST_BUSY','La solicitud sigue procesándose. Vuelve a intentarlo con la misma referencia.');
