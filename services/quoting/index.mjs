import { randomUUID } from 'node:crypto';
import { identity, requireRole } from '../shared/auth.mjs';
import { httpHandler, jsonBody, requireId, response, idempotencyKey, quoteRequest, hash, validUuid } from '../shared/http.mjs';
import { notFound, badRequest } from '../shared/errors.mjs';
import { calculatePrice } from './domain/price.mjs';
import { planFor, usageMetric, monthlyPeriod } from '../shared/quota.mjs';
import { pilotWindow, metricsDays, correctionReasons } from './domain/pilot-metrics.mjs';

export function createQuotingHandler({repository,readCatalog,authorize=identity,clock=()=>new Date(),newId=randomUUID}) {
  return httpHandler(async(event,correlationId)=>{
    const user=await authorize(event);
    const plan=user.plan ?? planFor();
    const method=event.requestContext?.http?.method;
    const path=event.rawPath;
    if(method==='GET' && path==='/api/v1/quotes/metrics') {
      requireRole(user,['admin']);
      return response(200,await repository.metrics(user.organizationId,pilotWindow(metricsDays(event),clock())),correlationId);
    }
    const correctionPath=/^\/api\/v1\/quotes\/([^/]+)\/corrections$/.exec(path);
    if(method==='POST' && correctionPath) {
      requireRole(user,['admin','seller']);
      const body=jsonBody(event);
      if(Object.keys(body).length!==2 || !Object.keys(body).every(key=>['correctionId','reason'].includes(key)) || !validUuid(body.correctionId) || !correctionReasons.includes(body.reason)) throw badRequest('Selecciona un motivo válido y una referencia única para la corrección.');
      const correction={quoteId:requireId(correctionPath[1]),correctionId:body.correctionId,reason:body.reason,reportedAt:clock().toISOString()};
      const saved=await repository.reportCorrection(user.organizationId,correction.quoteId,correction);
      return response(saved.created ? 201 : 200,saved.correction,correlationId);
    }
    if(method==='GET' && path==='/api/v1/quotes/usage') {
      const period=monthlyPeriod(clock());
      return response(200,{planId:plan.id,issuedQuotesPerMonth:usageMetric(await repository.usage(user.organizationId,period),plan.limits.issuedQuotesPerMonth),period},correlationId);
    }
    const lookup=/^\/api\/v1\/quotes\/([^/]+)$/.exec(path);
    if (method==='GET' && lookup) {
      const quote=await repository.get(user.organizationId,requireId(lookup[1]));
      if (!quote) throw notFound();
      return response(200,quote,correlationId);
    }
    if (method==='POST' && (path==='/api/v1/quotes/preview' || path==='/api/v1/quotes')) {
      requireRole(user,['admin','seller']);
      const body=quoteRequest(jsonBody(event));
      const commercial={catalogId:body.catalogId,version:body.version,currency:body.currency,items:body.items};
      const emit=path==='/api/v1/quotes';
      const key=emit ? idempotencyKey(event) : undefined;
      const requestHash=hash(commercial);
      if (emit) {
        const existing=await repository.findReplay(user.organizationId,key,requestHash);
        if (existing) return response(200,existing,correlationId);
      }
      const catalog=await readCatalog(user.organizationId,body.catalogId,body.version);
      if (!catalog) throw notFound();
      const now=clock();
      const preview=calculatePrice(catalog,commercial,{now});
      if (!emit) return response(200,preview,correlationId);
      const quote={quoteId:newId(),issuedAt:now.toISOString(),...preview,items:structuredClone(commercial.items),...(body.pilot ? {pilot:structuredClone(body.pilot)} : {})};
      const actorKey=hash({organizationId:user.organizationId,subject:user.subject});
      const saved=await repository.issue(user.organizationId,key,requestHash,quote,{limit:plan.limits.issuedQuotesPerMonth,period:monthlyPeriod(now),actorKey});
      return response(saved.created ? 201 : 200,saved.quote,correlationId);
    }
    throw notFound();
  });
}

let configured;
export async function handler(event) {
  configured ??= Promise.all([import('../shared/dynamo.mjs'),import('../shared/team-client.mjs')]).then(([{createQuoteRepository,createCatalogReader},{createTeamAuthorizer}])=>createQuotingHandler({repository:createQuoteRepository(),readCatalog:createCatalogReader(),authorize:createTeamAuthorizer()}));
  return (await configured)(event);
}
