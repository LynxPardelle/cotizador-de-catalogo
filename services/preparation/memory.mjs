import {conflict,notFound} from '../shared/errors.mjs';
import {encodeCursor,applicationItem} from '../applications/domain.mjs';
import {selectedRoot,initialPreparation,changedPreparation,preparationConflict,historyEvent,historyDto} from './domain.mjs';
const key=(reference,SK='RECORD')=>`INTEREST#${reference}/${SK}`;
export function createMemoryPreparationRepository({itemsMap=new Map()}={}){
 const get=(reference,now)=>selectedRoot(itemsMap.get(key(reference)),now);
 return {
  async get(reference,now){const item=applicationItem(itemsMap.get(key(reference)),now);if(!item)throw notFound();return structuredClone(item);},
  async replay(reference,mutationId,requestHash,now){get(reference,now);const old=itemsMap.get(key(reference,`PREP_REPLAY#${mutationId}`));if(old&&old.requestHash!==requestHash)throw conflict();return old?structuredClone(old.preparation):undefined;},
  async mutate(reference,{kind,input,subject,actorKey,requestHash,now}){
   const root=get(reference,now),old=itemsMap.get(key(reference,`PREP_REPLAY#${input.mutationId}`));if(old){if(old.requestHash!==requestHash)throw conflict();return structuredClone(old.preparation);}if(initialPreparation(root).version!==input.expectedVersion)throw preparationConflict();
   const preparation=changedPreparation(root,kind,input,subject,now),PK=root.PK,SK=`PREP_HISTORY#${String(preparation.version).padStart(12,'0')}`;
   itemsMap.set(key(reference),{...root,preparation});itemsMap.set(key(reference,SK),{PK,SK,event:historyEvent(preparation,kind,input,actorKey,now),expiresAt:root.expiresAt});const replaySK=`PREP_REPLAY#${input.mutationId}`;itemsMap.set(key(reference,replaySK),{PK,SK:replaySK,requestHash,preparation:structuredClone(preparation),expiresAt:root.expiresAt});return structuredClone(preparation);
  },
  async history(reference,{cursor,now}){get(reference,now);const all=[...itemsMap.values()].filter(item=>item.PK===`INTEREST#${reference}`&&item.SK.startsWith('PREP_HISTORY#')).sort((a,b)=>b.SK.localeCompare(a.SK));const start=cursor?all.findIndex(item=>item.SK===cursor.SK)+1:0,page=all.slice(start,start+20);return {items:page.map(item=>historyDto(item.event)),nextCursor:start+20<all.length?encodeCursor({PK:page.at(-1).PK,SK:page.at(-1).SK},{kind:'preparation-history',reference}):null};},
 };
}
