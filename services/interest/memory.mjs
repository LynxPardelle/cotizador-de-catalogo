import {conflict} from '../shared/errors.mjs';
import {interestLimit} from './domain.mjs';

export function createMemoryInterestRepository(){
  const records=new Map(),counts=new Map();
  return {
    async get(id){const value=records.get(id);return value?structuredClone(value):undefined;},
    async submit(record,requestHash,{period,limit=200}){
      const existing=records.get(record.requestId);
      if(existing){if(existing.requestHash!==requestHash)throw conflict();return {reference:existing.record.requestId,status:'received'};}
      const used=counts.get(period.day)??0;if(used>=limit)throw interestLimit();
      records.set(record.requestId,{record:structuredClone(record),requestHash});counts.set(period.day,used+1);
      return {reference:record.requestId,status:'received'};
    },
  };
}
