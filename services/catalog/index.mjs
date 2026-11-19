import { identity, requireRole } from '../shared/auth.mjs';
import { httpHandler, jsonBody, requireId, versionNumber, response, validId } from '../shared/http.mjs';
import { badRequest, notFound } from '../shared/errors.mjs';
import { validateCatalog } from '../quoting/domain/price.mjs';

export function createCatalogHandler({repository}) {
  const publicHandler = httpHandler(async(event, correlationId) => {
    const user = identity(event);
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;
    if (method === 'GET' && path === '/api/v1/catalogs') return response(200,{catalogs:await repository.list(user.organizationId)},correlationId);
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
      const result = await repository.publish(user.organizationId,catalog);
      return response(result.created ? 201 : 200,result.catalog,correlationId);
    }
    throw notFound();
  });
  return async event => {
    // This envelope is reachable only through direct IAM Lambda invocation.
    // HTTP events always retain requestContext and never take this branch.
    if (!event?.requestContext && event?.operation === 'getPublishedCatalog') {
      if (!validId(event.organizationId)) throw badRequest('La organización no es válida.');
      const catalog = await repository.get(event.organizationId,requireId(event.catalogId),versionNumber(event.version));
      return catalog ?? null;
    }
    return publicHandler(event);
  };
}

let configured;
export async function handler(event) {
  configured ??= import('../shared/dynamo.mjs').then(({createCatalogRepository})=>createCatalogRepository()).then(repository=>createCatalogHandler({repository}));
  return (await configured)(event);
}
