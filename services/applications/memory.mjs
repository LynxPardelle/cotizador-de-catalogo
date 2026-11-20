import {hash} from '../shared/http.mjs';
import {conflict,notFound} from '../shared/errors.mjs';
import {summary,detail,applicationItem,initialReview,epoch,encodeCursor,reviewConflict,historyEvent} from './domain.mjs';
const key=(reference,SK)=>`INTEREST#${reference}/${SK}`;
export function createMemoryApplicationsRepository({itemsMap=new Map()}={}){
 const get=(reference)=>itemsMap.get(key(reference,'RECORD'));
 return {
  async list({status='all',cursor,now=new Date()}={}){
   const entries=[...itemsMap.values()];let start=cursor?entries.findIndex(value=>value.PK===cursor.PK&&value.SK===cursor.SK)+1:0;const items=[];let scannedCount=0,last;
   while(start<entries.length&&scannedCount<100&&items.length<25){const item=entries[start++];scannedCount++;last={PK:item.PK,SK:item.SK};const view=summary(item,now);if(view&&(status==='all'||view.review.status===status))items.push(view);}
   return {items,nextCursor:start<entries.length?encodeCursor(last,{kind:'list',status}):null,scannedCount};
  },
  async detail(reference,now){return detail(get(reference),now);},
  async history(reference,{cursor,now=new Date()}={}){
   if(!applicationItem(get(reference),now))throw notFound();const all=[...itemsMap.values()].filter(value=>value.PK===`INTEREST#${reference}`&&value.SK.startsWith('REVIEW#')&&value.expiresAt>epoch(now)).sort((a,b)=>b.SK.localeCompare(a.SK));const start=cursor?all.findIndex(value=>value.SK===cursor.SK)+1:0;const page=all.slice(start,start+20);return {items:page.map(value=>structuredClone(value.event)),nextCursor:start+20<all.length?encodeCursor({PK:page.at(-1).PK,SK:page.at(-1).SK},{kind:'history',reference}):null};
  },
  async update(reference,body,{actorKey,now}){
   const original=get(reference);if(!applicationItem(original,now))throw notFound();const requestHash=hash(body),replayKey=key(reference,`REPLAY#${body.mutationId}`),prior=itemsMap.get(replayKey);
   if(prior){if(prior.requestHash!==requestHash)throw conflict();return structuredClone(prior.result);}
   const previous=initialReview(original);if(previous.version!==body.expectedVersion)throw reviewConflict();
   const updatedAt=now.toISOString(),review={status:body.status,version:previous.version+1,updatedAt,nextActionDate:body.nextActionDate};const result={reference,review};
   itemsMap.set(key(reference,'RECORD'),{...original,review});const event=historyEvent(previous,body,actorKey,updatedAt);const SK=`REVIEW#${String(review.version).padStart(12,'0')}`;
   itemsMap.set(key(reference,SK),{PK:original.PK,SK,event,expiresAt:original.expiresAt});itemsMap.set(replayKey,{PK:original.PK,SK:`REPLAY#${body.mutationId}`,requestHash,result:structuredClone(result),expiresAt:original.expiresAt});return structuredClone(result);
  },
 };
}
