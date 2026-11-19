import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { hash } from './http.mjs';
import { conflict, HttpError, notFound } from './errors.mjs';
import { quotaExceeded, usageMetric, monthlyPeriod } from './quota.mjs';

const documentClient = () => DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}});
const orgKey = org => `ORG#${org}`;
const catalogKey = (id,version) => `CATALOG#${id}#VERSION#${String(version).padStart(9,'0')}`;
const quoteKey = id => `QUOTE#${id}`;
const replayKey = key => `IDEMPOTENCY#${hash(key)}`;
function requireTable(table) { if (!table) throw new Error('Missing required table configuration'); return table; }
const headKey=id=>`HEAD#${id}`;
const retryable=()=>new HttpError(409,'USAGE_BUSY','Otra operación actualizó el consumo. Vuelve a intentarlo con la misma solicitud.');
const pause=attempt=>new Promise(resolve=>setTimeout(resolve,15*(attempt+1)+Math.floor(Math.random()*20)));
async function queryItems(client,table,org,prefix) {
  const items=[];let ExclusiveStartKey;
  do {
    const page=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':orgKey(org),':prefix':prefix},ConsistentRead:true,ExclusiveStartKey}));
    items.push(...(page.Items ?? []));ExclusiveStartKey=page.LastEvaluatedKey;
  } while(ExclusiveStartKey);
  return items;
}
function countValue(item) {
  if(!Number.isSafeInteger(item?.used) || item.used<0) throw new HttpError(503,'USAGE_UNAVAILABLE','No pudimos validar el consumo de este espacio de trabajo.');
  return item.used;
}
function countUpdate(table,org,SK,delta,limit) {
  const expression=delta<0 ? '#used >= :one' : limit!==undefined ? '#used < :limit' : 'attribute_exists(#used)';
  return {Update:{TableName:table,Key:{PK:orgKey(org),SK},UpdateExpression:'ADD #used :delta',ConditionExpression:expression,ExpressionAttributeNames:{'#used':'used'},ExpressionAttributeValues:{':delta':delta,...(delta<0 ? {':one':1} : limit!==undefined ? {':limit':limit} : {})}}};
}

export function createCatalogRepository({client=documentClient(),table=process.env.CATALOG_TABLE}={}) {
  requireTable(table);
  const counterSK='USAGE#CATALOGS';
  const rawGet=async(org,SK)=>(await client.send(new GetCommand({TableName:table,Key:{PK:orgKey(org),SK},ConsistentRead:true}))).Item;
  async function listing(org) {
    const [versions,heads]=await Promise.all([queryItems(client,table,org,'CATALOG#'),queryItems(client,table,org,'HEAD#')]);
    const latest=new Map();const states=new Map(heads.map(head=>[head.catalogId,head.active]));
    for(const {catalog} of versions) if(catalog && (!latest.has(catalog.catalogId) || latest.get(catalog.catalogId).version<catalog.version)) latest.set(catalog.catalogId,catalog);
    const result={catalogs:[],archivedCatalogs:[]};
    for(const catalog of [...latest.values()].sort((a,b)=>a.catalogId.localeCompare(b.catalogId))) result[states.get(catalog.catalogId)===false ? 'archivedCatalogs' : 'catalogs'].push(catalog);
    return result;
  }
  async function ensureCounter(org) {
    const current=await rawGet(org,counterSK);if(current) return countValue(current);
    // All writers wait for this marker. A competing bootstrap can only win once;
    // later catalog writes update the same item atomically with their lifecycle.
    const used=(await listing(org)).catalogs.length;
    try {await client.send(new PutCommand({TableName:table,Item:{PK:orgKey(org),SK:counterSK,used},ConditionExpression:'attribute_not_exists(PK)'}));return used;}
    catch(error) {if(error.name!=='ConditionalCheckFailedException') throw error;return countValue(await rawGet(org,counterSK));}
  }
  async function existingHead(org,id) {
    const existing=await rawGet(org,headKey(id));if(existing) return existing;
    const legacy=await client.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':orgKey(org),':prefix':`CATALOG#${id}#VERSION#`},ConsistentRead:true,Limit:1}));
    if(!(legacy.Items ?? []).some(item=>item.catalog)) return undefined;
    const head={PK:orgKey(org),SK:headKey(id),catalogId:id,active:true};
    try {await client.send(new PutCommand({TableName:table,Item:head,ConditionExpression:'attribute_not_exists(PK)'}));return head;}
    catch(error) {if(error.name!=='ConditionalCheckFailedException') throw error;return rawGet(org,headKey(id));}
  }
  const repository={
    async get(org,id,version) {
      const result=await client.send(new GetCommand({TableName:table,Key:{PK:orgKey(org),SK:catalogKey(id,version)},ConsistentRead:true}));
      return result.Item?.catalog;
    },
    async getPublished(org,id,version) {if((await rawGet(org,headKey(id)))?.active===false) return undefined;return repository.get(org,id,version);},
    listing,
    async list(org) {return (await listing(org)).catalogs;},
    usage:ensureCounter,
    async publish(org,catalog,{limit}={},attempt=0) {
      const prior=await repository.get(org,catalog.catalogId,catalog.version);
      if(prior) {if(hash(prior)!==hash(catalog)) throw conflict();return {catalog:prior,created:false};}
      await ensureCounter(org);const head=await existingHead(org,catalog.catalogId);
      const versionPut={Put:{TableName:table,Item:{PK:orgKey(org),SK:catalogKey(catalog.catalogId,catalog.version),catalog},ConditionExpression:'attribute_not_exists(PK)'}};
      try {
        if(head) await client.send(new PutCommand(versionPut.Put));
        else await client.send(new TransactWriteCommand({TransactItems:[versionPut,{Put:{TableName:table,Item:{PK:orgKey(org),SK:headKey(catalog.catalogId),catalogId:catalog.catalogId,active:true},ConditionExpression:'attribute_not_exists(PK)'}},countUpdate(table,org,counterSK,1,limit)]}));
        return {catalog,created:true};
      } catch(error) {
        if(!['ConditionalCheckFailedException','TransactionCanceledException'].includes(error.name)) throw error;
        const existing=await repository.get(org,catalog.catalogId,catalog.version);
        if(existing) {if(hash(existing)!==hash(catalog)) throw conflict();return {catalog:existing,created:false};}
        const currentHead=await rawGet(org,headKey(catalog.catalogId));
        if(!currentHead && limit!==undefined) {const used=await ensureCounter(org);if(used>=limit) throw quotaExceeded(usageMetric(used,limit));}
        if(attempt>=4) throw retryable();await pause(attempt);return repository.publish(org,catalog,{limit},attempt+1);
      }
    },
    async setStatus(org,id,active,{limit}={},attempt=0) {
      await ensureCounter(org);const head=await existingHead(org,id);if(!head) throw notFound();
      if(head.active===active) return {catalogId:id,active};
      try {
        await client.send(new TransactWriteCommand({TransactItems:[{Update:{TableName:table,Key:{PK:orgKey(org),SK:headKey(id)},UpdateExpression:'SET #active = :active',ConditionExpression:'#active = :old',ExpressionAttributeNames:{'#active':'active'},ExpressionAttributeValues:{':active':active,':old':head.active}}},countUpdate(table,org,counterSK,active ? 1 : -1,active ? limit : undefined)]}));
        return {catalogId:id,active};
      } catch(error) {
        if(error.name!=='TransactionCanceledException') throw error;
        if((await rawGet(org,headKey(id)))?.active===active) return {catalogId:id,active};
        if(active && limit!==undefined) {const used=await ensureCounter(org);if(used>=limit) throw quotaExceeded(usageMetric(used,limit));}
        if(attempt>=4) throw retryable();await pause(attempt);return repository.setStatus(org,id,active,{limit},attempt+1);
      }
    },
  };
  return repository;
}

export function createQuoteRepository({client=documentClient(),table=process.env.QUOTES_TABLE}={}) {
  requireTable(table);
  const rawGet=async(org,SK)=>(await client.send(new GetCommand({TableName:table,Key:{PK:orgKey(org),SK},ConsistentRead:true}))).Item;
  async function ensureCounter(org,period) {
    const SK=`USAGE#${period.key}`;const current=await rawGet(org,SK);if(current) return countValue(current);
    const start=Date.parse(period.startsAt),end=Date.parse(period.resetsAt);
    const records=await queryItems(client,table,org,'QUOTE#');
    const used=records.filter(({quote})=>{const issuedAt=Date.parse(quote?.issuedAt);return Number.isFinite(issuedAt) && issuedAt>=start && issuedAt<end;}).length;
    try {await client.send(new PutCommand({TableName:table,Item:{PK:orgKey(org),SK,used},ConditionExpression:'attribute_not_exists(PK)'}));return used;}
    catch(error) {if(error.name!=='ConditionalCheckFailedException') throw error;return countValue(await rawGet(org,SK));}
  }
  const repository={
    usage:ensureCounter,
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
    async issue(org,key,requestHash,quote,{limit,period=monthlyPeriod(new Date(quote.issuedAt))}={},attempt=0) {
      const prior=await repository.findReplay(org,key,requestHash);if(prior) return {quote:prior,created:false};
      await ensureCounter(org,period);
      try {
        await client.send(new TransactWriteCommand({TransactItems:[
          {Put:{TableName:table,Item:{PK:orgKey(org),SK:quoteKey(quote.quoteId),quote},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}},
          {Put:{TableName:table,Item:{PK:orgKey(org),SK:replayKey(key),quoteId:quote.quoteId,requestHash},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}},
          countUpdate(table,org,`USAGE#${period.key}`,1,limit),
        ]}));
        return {quote,created:true};
      } catch(error) {
        if(error.name!=='TransactionCanceledException') throw error;
        const existing=await repository.findReplay(org,key,requestHash);if(existing) return {quote:existing,created:false};
        if(limit!==undefined) {
          const used=await ensureCounter(org,period);
          if(used>=limit) {
            const committed=await repository.findReplay(org,key,requestHash);if(committed) return {quote:committed,created:false};
            throw quotaExceeded(usageMetric(used,limit));
          }
        }
        if(attempt>=4) throw retryable();await pause(attempt);return repository.issue(org,key,requestHash,quote,{limit,period},attempt+1);
      }
    },
  };
  return repository;
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
