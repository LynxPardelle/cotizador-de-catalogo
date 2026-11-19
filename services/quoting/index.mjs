import { randomUUID } from 'node:crypto';
import { identity, requireRole } from '../shared/auth.mjs';
import { httpHandler, jsonBody, requireId, response, idempotencyKey, quoteRequest, hash } from '../shared/http.mjs';
import { notFound } from '../shared/errors.mjs';
import { calculatePrice } from './domain/price.mjs';

export function createQuotingHandler({repository,readCatalog,clock=()=>new Date(),newId=randomUUID}) {
  return httpHandler(async(event,correlationId)=>{
    const user=identity(event);
    const method=event.requestContext?.http?.method;
    const path=event.rawPath;
    const lookup=/^\/api\/v1\/quotes\/([^/]+)$/.exec(path);
    if (method==='GET' && lookup) {
      const quote=await repository.get(user.organizationId,requireId(lookup[1]));
      if (!quote) throw notFound();
      return response(200,quote,correlationId);
    }
    if (method==='POST' && (path==='/api/v1/quotes/preview' || path==='/api/v1/quotes')) {
      requireRole(user,['admin','seller']);
      const body=quoteRequest(jsonBody(event));
      const emit=path==='/api/v1/quotes';
      const key=emit ? idempotencyKey(event) : undefined;
      const requestHash=hash(body);
      if (emit) {
        const existing=await repository.findReplay(user.organizationId,key,requestHash);
        if (existing) return response(200,existing,correlationId);
      }
      const catalog=await readCatalog(user.organizationId,body.catalogId,body.version);
      if (!catalog) throw notFound();
      const now=clock();
      const preview=calculatePrice(catalog,body,{now});
      if (!emit) return response(200,preview,correlationId);
      const quote={quoteId:newId(),issuedAt:now.toISOString(),...preview,items:structuredClone(body.items)};
      const saved=await repository.issue(user.organizationId,key,requestHash,quote);
      return response(saved.created ? 201 : 200,saved.quote,correlationId);
    }
    throw notFound();
  });
}

let configured;
export async function handler(event) {
  configured ??= import('../shared/dynamo.mjs').then(async({createQuoteRepository,createCatalogReader})=>createQuotingHandler({repository:await createQuoteRepository(),readCatalog:await createCatalogReader()}));
  return (await configured)(event);
}
