import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {conflict} from '../shared/errors.mjs';
import {interestLimit,interestBusy} from './domain.mjs';

const documentClient=()=>DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}});
const recordKey=id=>({PK:`INTEREST#${id}`,SK:'RECORD'});
const pause=attempt=>new Promise(resolve=>setTimeout(resolve,15*(attempt+1)+Math.floor(Math.random()*20)));
function receipt(existing,requestHash){
  if(existing.requestHash!==requestHash)throw conflict();
  return {reference:existing.record.requestId,status:'received'};
}
export function createInterestRepository({client=documentClient(),table=process.env.INTEREST_TABLE,wait=pause}={}){
  if(!table)throw new Error('Missing required interest table configuration');
  const get=async id=>(await client.send(new GetCommand({TableName:table,Key:recordKey(id),ConsistentRead:true}))).Item;
  const repository={
    get,
    async submit(record,requestHash,{period,limit=200},attempt=0){
      const prior=await get(record.requestId);if(prior)return receipt(prior,requestHash);
      const capacityKey={PK:`DAILY#${period.day}`,SK:'COUNTER'};
      try{
        await client.send(new TransactWriteCommand({TransactItems:[
          {Put:{TableName:table,Item:{...recordKey(record.requestId),reference:record.requestId,status:'received',createdAt:record.createdAt,expiresAt:record.expiresAt,requestHash,record},ConditionExpression:'attribute_not_exists(PK)'}},
          {Update:{TableName:table,Key:capacityKey,UpdateExpression:'SET expiresAt = if_not_exists(expiresAt, :expiresAt) ADD #used :one',ConditionExpression:'attribute_not_exists(PK) OR (#used >= :zero AND #used < :limit)',ExpressionAttributeNames:{'#used':'used'},ExpressionAttributeValues:{':one':1,':zero':0,':limit':limit,':expiresAt':period.expiresAt}}},
        ]}));
        return {reference:record.requestId,status:'received'};
      }catch(error){
        if(!['TransactionCanceledException','TransactionConflictException'].includes(error.name))throw error;
        const committed=await get(record.requestId);if(committed)return receipt(committed,requestHash);
        const current=(await client.send(new GetCommand({TableName:table,Key:capacityKey,ConsistentRead:true}))).Item;
        if(current){
          if(!Number.isSafeInteger(current.used)||current.used<0)throw interestBusy();
          if(current.used>=limit){const replay=await get(record.requestId);if(replay)return receipt(replay,requestHash);throw interestLimit();}
        }
        if(attempt>=4)throw interestBusy();await wait(attempt);
        return repository.submit(record,requestHash,{period,limit},attempt+1);
      }
    },
  };
  return repository;
}
