import {httpHandler,jsonBody,response,hash} from '../shared/http.mjs';
import {HttpError,notFound} from '../shared/errors.mjs';
import {interestRequest,interestPeriod} from './domain.mjs';

export function createInterestHandler({repository,clock=()=>new Date(),dailyLimit=200}){
  if(!Number.isSafeInteger(dailyLimit)||dailyLimit<1)throw new Error('Invalid internal interest capacity');
  return httpHandler(async(event,correlationId)=>{
    if(event.requestContext?.http?.method!=='POST'||event.rawPath!=='/api/v1/pilot-interest')throw notFound();
    if(typeof event.body==='string'&&Buffer.byteLength(event.body)>8192)throw new HttpError(413,'PAYLOAD_TOO_LARGE','El formulario debe ser menor de 8 KB.');
    const body=interestRequest(jsonBody(event));
    const now=clock(),period=interestPeriod(now),createdAt=now.toISOString();
    const record={...body,status:'received',createdAt,acceptedAt:createdAt,expiresAt:Math.floor(now.getTime()/1000)+90*86400};
    try{return response(202,await repository.submit(record,hash(body),{period,limit:dailyLimit}),correlationId);}
    catch(error){
      if(error instanceof HttpError&&error.statusCode===429){const result=response(429,{error:{code:error.code,message:error.message},correlationId},correlationId);result.headers['retry-after']=String(period.retryAfter);return result;}
      throw error;
    }
  });
}
let configured;
export async function handler(event){
  configured??=import('./dynamo.mjs').then(({createInterestRepository})=>createInterestHandler({repository:createInterestRepository()}));
  return (await configured)(event);
}
