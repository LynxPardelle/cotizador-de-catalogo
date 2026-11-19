import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { hash } from './http.mjs';
import { conflict, HttpError } from './errors.mjs';

const documentClient = () => DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}});
const orgKey = org => `ORG#${org}`;
const catalogKey = (id,version) => `CATALOG#${id}#VERSION#${String(version).padStart(9,'0')}`;
const quoteKey = id => `QUOTE#${id}`;
const replayKey = key => `IDEMPOTENCY#${hash(key)}`;
function requireTable(table) { if (!table) throw new Error('Missing required table configuration'); return table; }

export function createCatalogRepository({client=documentClient(),table=process.env.CATALOG_TABLE}={}) {
  requireTable(table);
  return {
    async get(org,id,version) {
      const result=await client.send(new GetCommand({TableName:table,Key:{PK:orgKey(org),SK:catalogKey(id,version)},ConsistentRead:true}));
      return result.Item?.catalog;
    },
    async list(org) {
      const latest=new Map(); let cursor;
      do {
        const result=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':orgKey(org),':prefix':'CATALOG#'},ConsistentRead:true,ExclusiveStartKey:cursor}));
        for(const {catalog} of result.Items ?? []) if (!latest.has(catalog.catalogId) || latest.get(catalog.catalogId).version<catalog.version) latest.set(catalog.catalogId,catalog);
        cursor=result.LastEvaluatedKey;
      } while(cursor);
      return [...latest.values()].sort((a,b)=>a.catalogId.localeCompare(b.catalogId));
    },
    async publish(org,catalog) {
      try {
        await client.send(new PutCommand({TableName:table,Item:{PK:orgKey(org),SK:catalogKey(catalog.catalogId,catalog.version),catalog},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}));
        return {catalog,created:true};
      } catch(error) {
        if (error.name!=='ConditionalCheckFailedException') throw error;
        const existing=await this.get(org,catalog.catalogId,catalog.version);
        if (!existing || hash(existing)!==hash(catalog)) throw conflict();
        return {catalog:existing,created:false};
      }
    },
  };
}

export function createQuoteRepository({client=documentClient(),table=process.env.QUOTES_TABLE}={}) {
  requireTable(table);
  return {
    async get(org,id) {
      const result=await client.send(new GetCommand({TableName:table,Key:{PK:orgKey(org),SK:quoteKey(id)},ConsistentRead:true}));
      return result.Item?.quote;
    },
    async findReplay(org,key,requestHash) {
      const result=await client.send(new GetCommand({TableName:table,Key:{PK:orgKey(org),SK:replayKey(key)},ConsistentRead:true}));
      if(!result.Item) return undefined;
      if(result.Item.requestHash!==requestHash) throw conflict();
      const quote=await this.get(org,result.Item.quoteId);
      if(!quote) throw new Error('Idempotency invariant violated');
      return quote;
    },
    async issue(org,key,requestHash,quote) {
      try {
        await client.send(new TransactWriteCommand({TransactItems:[
          {Put:{TableName:table,Item:{PK:orgKey(org),SK:quoteKey(quote.quoteId),quote},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}},
          {Put:{TableName:table,Item:{PK:orgKey(org),SK:replayKey(key),quoteId:quote.quoteId,requestHash},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}},
        ]}));
        return {quote,created:true};
      } catch(error) {
        if(error.name!=='TransactionCanceledException') throw error;
        const existing=await this.findReplay(org,key,requestHash);
        if(!existing) throw error;
        return {quote:existing,created:false};
      }
    },
  };
}

export function createCatalogReader({client=new LambdaClient({}),functionName=process.env.CATALOG_FUNCTION_NAME}={}) {
  if(!functionName) throw new Error('Missing catalog service function configuration');
  return async(organizationId,catalogId,version)=>{
    const result=await client.send(new InvokeCommand({FunctionName:functionName,InvocationType:'RequestResponse',Payload:Buffer.from(JSON.stringify({operation:'getPublishedCatalog',organizationId,catalogId,version}))}));
    if(result.FunctionError || !result.Payload) throw new HttpError(503,'CATALOG_UNAVAILABLE','El catálogo no está disponible temporalmente.');
    try { return JSON.parse(Buffer.from(result.Payload).toString('utf8')); }
    catch { throw new HttpError(503,'CATALOG_UNAVAILABLE','El catálogo no está disponible temporalmente.'); }
  };
}
