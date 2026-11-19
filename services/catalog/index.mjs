import { identity, requireRole } from '../shared/auth.mjs';
import { httpHandler, jsonBody, requireId, versionNumber, response, validId } from '../shared/http.mjs';
import { badRequest, notFound } from '../shared/errors.mjs';
import { validateCatalog } from '../quoting/domain/price.mjs';
import { planFor, usageMetric } from '../shared/quota.mjs';

export function createCatalogHandler({repository,authorize=identity}) {
  const publicHandler = httpHandler(async(event, correlationId) => {
    const user = await authorize(event);
    const plan=user.plan ?? planFor();
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;
    if (method === 'GET' && path === '/api/v1/catalogs/usage') return response(200,{planId:plan.id,activeCatalogs:usageMetric(await repository.usage(user.organizationId),plan.limits.activeCatalogs)},correlationId);
    if (method === 'GET' && path === '/api/v1/catalogs') {
      const listed=await repository.listing(user.organizationId);
      return response(200,{catalogs:listed.catalogs,...(user.role==='admin' ? {archivedCatalogs:listed.archivedCatalogs} : {})},correlationId);
    }
    const status=/^\/api\/v1\/catalogs\/([^/]+)\/status$/.exec(path);
    if(method==='PATCH' && status) {
      requireRole(user,['admin']);const body=jsonBody(event);
      if(Object.keys(body).length!==1 || typeof body.active!=='boolean') throw badRequest('Indica si el catálogo debe estar activo.');
      return response(200,await repository.setStatus(user.organizationId,requireId(status[1]),body.active,{limit:plan.limits.activeCatalogs}),correlationId);
    }
    const read = /^\/api\/v1\/catalogs\/([^/]+)\/versions\/([^/]+)$/.exec(path);
    if (method === 'GET' && read) {
      const catalog = await repository.get(user.organizationId,requireId(read[1]),versionNumber(read[2]));
      if (!catalog) throw notFound();
      return response(200,catalog,correlationId);
    }
    const publication = /^\/api\/v1\/catalogs\/([^/]+)\/publications$/.exec(path);
    if (method === 'POST' && publication) {
      requireRole(user,['admin']);
      const catalog = jsonBody(event);
      if (catalog.catalogId !== requireId(publication[1])) throw badRequest('El catálogo de la ruta no coincide con el cuerpo.');
      validateCatalog(catalog);
      const result = await repository.publish(user.organizationId,catalog,{limit:plan.limits.activeCatalogs});
      return response(result.created ? 201 : 200,result.catalog,correlationId);
    }
    throw notFound();
  });
  return async event => {
    // This envelope is reachable only through direct IAM Lambda invocation.
    // HTTP events always retain requestContext and never take this branch.
    if (!event?.requestContext && event?.operation === 'getPublishedCatalog') {
      if (!validId(event.organizationId)) throw badRequest('La organización no es válida.');
      const catalog = await repository.getPublished(event.organizationId,requireId(event.catalogId),versionNumber(event.version));
      return catalog ?? null;
    }
    return publicHandler(event);
  };
}

let configured;
export async function handler(event) {
  configured ??= Promise.all([import('../shared/dynamo.mjs'),import('../shared/team-client.mjs')]).then(([{createCatalogRepository},{createTeamAuthorizer}])=>createCatalogHandler({repository:createCatalogRepository(),authorize:createTeamAuthorizer()}));
  return (await configured)(event);
}
