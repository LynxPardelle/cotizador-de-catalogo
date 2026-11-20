import {httpHandler,jsonBody,response,hash} from '../shared/http.mjs';
import {notFound,HttpError} from '../shared/errors.mjs';
import {requireReference,listQuery,historyQuery,parseUpdate,noQuery} from './domain.mjs';
import {isPreparationRoute,handler as preparationHandler} from '../preparation/index.mjs';
export function createApplicationsHandler({repository,authorize,clock=()=>new Date()}){
 if(typeof authorize!=='function')throw new Error('An applications reviewer authorizer is required');
 return httpHandler(async(event,correlationId)=>{
  const user=await authorize(event);const method=event.requestContext?.http?.method,path=event.rawPath;
  if(method==='GET'&&path==='/api/v1/pilot-applications/context'){noQuery(event);return response(200,{allowed:true},correlationId);}
  if(method==='GET'&&path==='/api/v1/pilot-applications')return response(200,await repository.list({...listQuery(event),now:clock()}),correlationId);
  const history=/^\/api\/v1\/pilot-applications\/([^/]+)\/history$/.exec(path);
  if(method==='GET'&&history){const reference=requireReference(history[1]);return response(200,await repository.history(reference,{...historyQuery(event,reference),now:clock()}),correlationId);}
  const resource=/^\/api\/v1\/pilot-applications\/([^/]+)$/.exec(path);
  if(resource){const reference=requireReference(resource[1]);noQuery(event);if(method==='GET')return response(200,await repository.detail(reference,clock()),correlationId);
   if(method==='PATCH'){
    if(typeof event.body==='string'&&Buffer.byteLength(event.body)>8192)throw new HttpError(413,'PAYLOAD_TOO_LARGE','La actualización debe ser menor de 8 KB.');
    const body=parseUpdate(jsonBody(event));return response(200,await repository.update(reference,body,{actorKey:hash({subject:user.subject}),now:clock()}),correlationId);
   }
  }
  throw notFound();
 });
}
let configured;
export async function handler(event){if(isPreparationRoute(event))return preparationHandler(event);configured??=Promise.all([import('./dynamo.mjs'),import('./auth.mjs')]).then(([{createApplicationsRepository},{createReviewerAuthorizer}])=>createApplicationsHandler({repository:createApplicationsRepository(),authorize:createReviewerAuthorizer()}));return (await configured)(event);}
