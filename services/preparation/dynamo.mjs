import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,QueryCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {conflict,notFound} from '../shared/errors.mjs';
import {applicationItem,epoch,encodeCursor} from '../applications/domain.mjs';
import {selectedRoot,initialPreparation,changedPreparation,historyEvent,historyDto,preparationConflict,preparationBusy} from './domain.mjs';
const documentClient=()=>DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}});
const pause=attempt=>new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));
const key=(reference,SK='RECORD')=>({PK:`INTEREST#${reference}`,SK});
export function createPreparationRepository({client=documentClient(),table=process.env.INTEREST_TABLE,wait=pause}={}){
 if(!table)throw new Error('INTEREST_TABLE is required');
 const read=async(reference,SK='RECORD')=>(await client.send(new GetCommand({TableName:table,Key:key(reference,SK),ConsistentRead:true}))).Item;
 const root=async(reference,now)=>{const item=applicationItem(await read(reference),now);if(!item)throw notFound();return item;};
 return {
  get:root,
  async replay(reference,mutationId,requestHash,now){selectedRoot(await root(reference,now),now);const old=await read(reference,`PREP_REPLAY#${mutationId}`);if(old&&old.requestHash!==requestHash)throw conflict();return old?structuredClone(old.preparation):undefined;},
  async mutate(reference,{kind,input,subject,actorKey,requestHash,now}){
   for(let attempt=0;attempt<5;attempt++){
    const original=selectedRoot(await root(reference,now),now),old=await read(reference,`PREP_REPLAY#${input.mutationId}`);if(old){if(old.requestHash!==requestHash)throw conflict();return structuredClone(old.preparation);}if(initialPreparation(original).version!==input.expectedVersion)throw preparationConflict();
    const preparation=changedPreparation(original,kind,input,subject,now),versionCondition=input.expectedVersion===0?'attribute_not_exists(#preparation)':'#preparation.#version = :version';
    try{
     await client.send(new TransactWriteCommand({TransactItems:[
      {Update:{TableName:table,Key:key(reference),UpdateExpression:'SET #preparation = :preparation',ConditionExpression:`attribute_exists(PK) AND #expiresAt > :now AND #review.#status = :selected AND ${versionCondition}`,ExpressionAttributeNames:{'#preparation':'preparation','#expiresAt':'expiresAt','#review':'review','#status':'status',...(input.expectedVersion?{'#version':'version'}:{})},ExpressionAttributeValues:{':preparation':preparation,':now':epoch(now),':selected':'selected',...(input.expectedVersion?{':version':input.expectedVersion}:{})}}},
      {Put:{TableName:table,Item:{...key(reference,`PREP_HISTORY#${String(preparation.version).padStart(12,'0')}`),event:historyEvent(preparation,kind,input,actorKey,now),expiresAt:original.expiresAt},ConditionExpression:'attribute_not_exists(PK)'}},
      {Put:{TableName:table,Item:{...key(reference,`PREP_REPLAY#${input.mutationId}`),requestHash,preparation:structuredClone(preparation),expiresAt:original.expiresAt},ConditionExpression:'attribute_not_exists(PK)'}},
     ]}));return preparation;
    }catch(error){if(!['TransactionCanceledException','TransactionConflictException'].includes(error.name))throw error;if(attempt===4)throw preparationBusy();await wait(attempt);}
   }
   throw preparationBusy();
  },
  async history(reference,{cursor,now}){
   selectedRoot(await root(reference,now),now);const result=await client.send(new QueryCommand({TableName:table,ConsistentRead:true,ScanIndexForward:false,Limit:20,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':`INTEREST#${reference}`,':prefix':'PREP_HISTORY#'},ProjectionExpression:'#event',ExpressionAttributeNames:{'#event':'event'},...(cursor?{ExclusiveStartKey:cursor}:{})}));return {items:(result.Items??[]).map(item=>historyDto(item.event)),nextCursor:encodeCursor(result.LastEvaluatedKey,{kind:'preparation-history',reference})};
  },
 };
}
