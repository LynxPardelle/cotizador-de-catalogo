import { randomUUID, createHash } from 'node:crypto';
import { badRequest, HttpError } from './errors.mjs';

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
export function jsonBody(event) {
  if (event.isBase64Encoded) throw badRequest('El cuerpo debe usar JSON sin codificación base64.');
  if (typeof event.body !== 'string' || Buffer.byteLength(event.body) > 200_000) throw badRequest('El cuerpo JSON es obligatorio y debe ser menor de 200 KB.');
  let body;
  try { body = JSON.parse(event.body); } catch { throw badRequest('El cuerpo no contiene JSON válido.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Se esperaba un objeto JSON.');
  if ('organizationId' in body || 'tenantId' in body) throw badRequest('La organización se obtiene de la sesión.');
  return body;
}
export const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
export function requireId(value) { if (!validId(value)) throw badRequest('El identificador no es válido.'); return value; }
export function versionNumber(value) {
  const number = typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 1 || number > 999_999_999) throw badRequest('La versión no es válida.');
  return number;
}
export function idempotencyKey(event) {
  const key = Object.entries(event.headers ?? {}).find(([name]) => name.toLowerCase() === 'idempotency-key')?.[1];
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) throw badRequest('Idempotency-Key es obligatorio (1 a 128 caracteres visibles).');
  return key;
}
export function response(statusCode, data, correlationId) {
  return {statusCode, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-correlation-id':correlationId},body:JSON.stringify(data)};
}
export function httpHandler(operation) {
  return async event => {
    const correlationId = typeof event?.requestContext?.requestId === 'string' ? event.requestContext.requestId : randomUUID();
    try { return await operation(event, correlationId); }
    catch (error) {
      const known = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && (error.statusCode < 500 || (error instanceof HttpError && error.statusCode < 600));
      if (!known) console.error(JSON.stringify({level:'error',correlationId,code:'INTERNAL_ERROR',errorName:error?.name ?? 'Error'}));
      return response(known ? error.statusCode : 500, {error:{code:known ? (error.code ?? 'INVALID_REQUEST') : 'INTERNAL_ERROR',message:known ? error.message : 'No se pudo completar la operación.'},correlationId}, correlationId);
    }
  };
}
export function quoteRequest(body) {
  const allowed = ['catalogId','version','currency','items','pilot'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw badRequest('La solicitud contiene campos desconocidos.');
  requireId(body.catalogId); versionNumber(body.version);
  if(Object.hasOwn(body,'pilot') && !validPilot(body.pilot)) throw badRequest('La medición del flujo no es válida.');
  return body;
}
export const validUuid=value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validPilot(value) {
  return !!value && typeof value==='object' && !Array.isArray(value)
    && Object.keys(value).length===3 && Object.keys(value).every(key=>['flowId','activeDurationMs','adjustments'].includes(key))
    && validUuid(value.flowId)
    && Number.isSafeInteger(value.activeDurationMs) && value.activeDurationMs>=0 && value.activeDurationMs<=28_800_000
    && Number.isSafeInteger(value.adjustments) && value.adjustments>=0 && value.adjustments<=1000;
}
