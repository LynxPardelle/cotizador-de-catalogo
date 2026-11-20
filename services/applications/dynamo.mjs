import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,ScanCommand,QueryCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {conflict,notFound} from '../shared/errors.mjs';
import {hash} from '../shared/http.mjs';
import {applicationItem,detail,encodeCursor,epoch,historyEvent,initialReview,reviewBusy,reviewConflict,summary} from './domain.mjs';

const documentClient=()=>DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}});
const pause=attempt=>new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));
const key=(reference,SK='RECORD')=>({PK:`INTEREST#${reference}`,SK});
const eventDto=value=>Object.fromEntries(['mutationId','version','previousStatus','status','previousNextActionDate','nextActionDate','note','actorKey','createdAt'].map(name=>[name,value[name]]));

export function createApplicationsRepository({client=documentClient(),table=process.env.INTEREST_TABLE,wait=pause}={}){
 if(!table)throw new Error('INTEREST_TABLE is required');
 const get=async(reference,SK='RECORD')=>(await client.send(new GetCommand({TableName:table,Key:key(reference,SK),ConsistentRead:true}))).Item;
 const requireRoot=async(reference,now)=>{const item=applicationItem(await get(reference),now);if(!item)throw notFound();return item;};
 const repository={
  async list({status='all',cursor,now}){
   const items=[];let scannedCount=0,lastKey=cursor;
   for(let page=0;page<4&&scannedCount<100&&items.length<25;page++){
    const result=await client.send(new ScanCommand({
     TableName:table,ConsistentRead:true,Limit:Math.min(25-items.length,100-scannedCount),
     ...(lastKey?{ExclusiveStartKey:lastKey}:{}),
     ProjectionExpression:'PK, SK, #reference, #createdAt, #expiresAt, #review, #record.#requestId, #record.#organizationName, #record.#sector',
     ExpressionAttributeNames:{'#reference':'reference','#createdAt':'createdAt','#expiresAt':'expiresAt','#review':'review','#record':'record','#requestId':'requestId','#organizationName':'organizationName','#sector':'sector'},
    }));
    scannedCount+=result.ScannedCount??result.Items?.length??0;
    for(const item of result.Items??[]){const row=summary(item,now);if(row&&(status==='all'||row.review.status===status))items.push(row);}
    lastKey=result.LastEvaluatedKey;if(!lastKey)break;
   }
   return {items,nextCursor:encodeCursor(lastKey,{kind:'list',status}),scannedCount};
  },
  async detail(reference,now){return detail(await get(reference),now);},
  async history(reference,{cursor,now}){
   await requireRoot(reference,now);
   const result=await client.send(new QueryCommand({
    TableName:table,ConsistentRead:true,ScanIndexForward:false,Limit:20,
    KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues:{':pk':`INTEREST#${reference}`,':prefix':'REVIEW#'},
    ProjectionExpression:'#event',ExpressionAttributeNames:{'#event':'event'},
    ...(cursor?{ExclusiveStartKey:cursor}:{}),
   }));
   return {items:(result.Items??[]).map(item=>eventDto(item.event)),nextCursor:encodeCursor(result.LastEvaluatedKey,{kind:'history',reference})};
  },
  async update(reference,body,{actorKey,now}){
   const requestHash=hash(body);
   for(let attempt=0;attempt<5;attempt++){
    // Retention is checked before returning a replay, including after a transaction race.
    const root=await requireRoot(reference,now),replay=await get(reference,`REPLAY#${body.mutationId}`);
    if(replay){if(replay.requestHash!==requestHash)throw conflict();return structuredClone(replay.result);}
    const previous=initialReview(root);if(previous.version!==body.expectedVersion)throw reviewConflict();
    const review={status:body.status,version:previous.version+1,updatedAt:now.toISOString(),nextActionDate:body.nextActionDate};
    const result={reference,review};
    const versionCondition=body.expectedVersion===0?'attribute_not_exists(#review)':'#review.#version = :expectedVersion';
    try{
     await client.send(new TransactWriteCommand({TransactItems:[
      {Update:{TableName:table,Key:key(reference),UpdateExpression:'SET #review = :review',
       ConditionExpression:`attribute_exists(PK) AND #expiresAt > :now AND ${versionCondition}`,
       ExpressionAttributeNames:{'#review':'review','#expiresAt':'expiresAt',...(body.expectedVersion===0?{}:{'#version':'version'})},
       ExpressionAttributeValues:{':review':review,':now':epoch(now),...(body.expectedVersion===0?{}:{':expectedVersion':body.expectedVersion})}}},
      {Put:{TableName:table,Item:{...key(reference,`REVIEW#${String(review.version).padStart(12,'0')}`),event:historyEvent(previous,body,actorKey,now.toISOString()),expiresAt:root.expiresAt},ConditionExpression:'attribute_not_exists(PK)'}},
      {Put:{TableName:table,Item:{...key(reference,`REPLAY#${body.mutationId}`),requestHash,result,expiresAt:root.expiresAt},ConditionExpression:'attribute_not_exists(PK)'}},
     ]}));
     return result;
    }catch(error){
     if(!['TransactionCanceledException','TransactionConflictException'].includes(error.name))throw error;
     if(attempt===4)throw reviewBusy();await wait(attempt);
    }
   }
   throw reviewBusy();
  },
 };
 return repository;
}
