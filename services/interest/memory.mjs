import {conflict} from '../shared/errors.mjs';
import {interestLimit} from './domain.mjs';

export function createMemoryInterestRepository({itemsMap=new Map()}={}){
  const counts=new Map(),key=id=>`INTEREST#${id}/RECORD`;
  return {
    async get(id){const value=itemsMap.get(key(id));return value?structuredClone(value):undefined;},
    async submit(record,requestHash,{period,limit=200}){
      const existing=itemsMap.get(key(record.requestId));
      if(existing){if(existing.requestHash!==requestHash)throw conflict();return {reference:existing.record.requestId,status:'received'};}
      const used=counts.get(period.day)??0;if(used>=limit)throw interestLimit();
      itemsMap.set(key(record.requestId),{PK:`INTEREST#${record.requestId}`,SK:'RECORD',reference:record.requestId,status:'received',createdAt:record.createdAt,expiresAt:record.expiresAt,record:structuredClone(record),requestHash});counts.set(period.day,used+1);
      return {reference:record.requestId,status:'received'};
    },
  };
}
