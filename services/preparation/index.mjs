import {httpHandler,jsonBody,response,hash} from '../shared/http.mjs';
import {notFound,HttpError} from '../shared/errors.mjs';
import {requireReference,noQuery} from '../applications/domain.mjs';
import {selectedRoot,initialPreparation,preparationDto,parseLink,parseCatalog,parseAgreements,historyQuery,mutationHash,readiness,catalogReady,catalogNotReady,alreadyLinked,forbidden} from './domain.mjs';
export function isPreparationRoute(event){return /^\/api\/v1\/pilot-applications\/[^/]+\/preparation(?:\/history)?$/.test(event?.rawPath??'')||/^\/api\/v1\/pilot-onboarding\/[^/]+(?:\/(?:link|catalog))?$/.test(event?.rawPath??'');}
export function createPreparationHandler({repository,authorizeReviewer,identifyParticipant,services,clock=()=>new Date()}){
 if(!repository||typeof authorizeReviewer!=='function'||typeof identifyParticipant!=='function'||!services)throw new Error('Preparation requires explicit repositories, identity and domain services.');
 return httpHandler(async(event,correlationId)=>{
  const operator=/^\/api\/v1\/pilot-applications\/([^/]+)\/preparation(\/history)?$/.exec(event.rawPath),participant=/^\/api\/v1\/pilot-onboarding\/([^/]+)(\/(?:link|catalog))?$/.exec(event.rawPath);if(!operator&&!participant)throw notFound();
  const user=operator?await authorizeReviewer(event):await identifyParticipant(event),reference=requireReference((operator??participant)[1]),now=clock(),root=await repository.get(reference,now);if(participant&&user.email!==root.record.contactEmail)throw notFound();let preparation=initialPreparation(root);
  if(participant&&preparation.workspaceId&&preparation.linkedSubject!==user.subject)throw notFound();
  selectedRoot(root,now);
  const method=event.requestContext?.http?.method;
  const view=async value=>({reference,organizationName:root.record.organizationName,expiresAt:root.expiresAt,preparation:preparationDto(value),readiness:await readiness(value,services,now),...(participant?{adminWorkspaces:await services.workspaces(user.subject)}:{})});
  if(operator?.[2]&&method==='GET')return response(200,await repository.history(reference,{...historyQuery(event,reference),now}),correlationId);noQuery(event);
  if(method==='GET'&&!operator?.[2]&&!participant?.[2])return response(200,await view(preparation),correlationId);
  let kind;if(operator&&!operator[2]&&method==='PATCH')kind='agreements';else if(participant&&method==='POST'&&participant[2]==='/link')kind='link';else if(participant&&method==='POST'&&participant[2]==='/catalog')kind='catalog';else throw notFound();
  if(typeof event.body==='string'&&Buffer.byteLength(event.body)>8192)throw new HttpError(413,'PAYLOAD_TOO_LARGE','La preparación debe ser menor de 8 KB.');
  const input=(kind==='link'?parseLink:kind==='catalog'?parseCatalog:parseAgreements)(jsonBody(event)),requestHash=mutationHash(kind,input,user.subject);
  const prior=await repository.replay(reference,input.mutationId,requestHash,now);
  if(participant){
   if(kind==='link'&&preparation.workspaceId&&(!prior||preparation.workspaceId!==input.workspaceId))throw alreadyLinked();if(kind==='catalog'&&!preparation.workspaceId)throw forbidden();
   const access=await services.access(user.subject,kind==='link'?input.workspaceId:preparation.workspaceId);if(!access?.adminReady)throw forbidden();
   if(kind==='catalog'&&!prior&&!catalogReady(await services.catalog(preparation.workspaceId,input.catalogId,input.version),input,now))throw catalogNotReady();
  }
  if(prior)preparation=prior;else preparation=await repository.mutate(reference,{kind,input,subject:user.subject,actorKey:hash({subject:user.subject}),requestHash,now});
  return response(200,await view(preparation),correlationId);
 });
}
let configured;
export async function handler(event){configured??=Promise.all([import('./dynamo.mjs'),import('./auth.mjs'),import('../applications/auth.mjs'),import('../shared/preparation-client.mjs')]).then(([{createPreparationRepository},{createPreparationIdentity},{createReviewerAuthorizer},{createPreparationServices}])=>createPreparationHandler({repository:createPreparationRepository(),identifyParticipant:createPreparationIdentity(),authorizeReviewer:createReviewerAuthorizer(),services:createPreparationServices()}));return (await configured)(event);}
