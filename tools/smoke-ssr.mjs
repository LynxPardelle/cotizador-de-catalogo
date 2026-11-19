import assert from 'node:assert/strict';
import { handler } from '../web/dist/lambda/index.mjs';

const request = (path, method = 'GET') => ({
  version: '2.0',
  rawPath: path,
  rawQueryString: '',
  headers: { host: 'cotitrama-dev.lynxpardelle.com', 'x-forwarded-proto': 'https' },
  requestContext: {
    requestId: 'smoke-local',
    domainName: 'cotitrama-dev.lynxpardelle.com',
    http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1' },
  },
  isBase64Encoded: false,
});
try {
const root = await handler(request('/'), {});
assert.equal(root.statusCode, 200);
assert.match(root.body, /CotiTrama/);
assert.match(root.body, /Crear cuenta|Empezar/);
for (const path of ['/cotizar', '/catalogos', '/propuestas/smoke-example']) {
  const response = await handler(request(path), {});
  assert.equal(response.statusCode, 200, `${path}: ${response.body}`);
  assert.match(response.body, /CotiTrama/);
  assert.match(response.body, /<app-root[^>]*>[\s\S]+<\/app-root>/);
  assert.doesNotMatch(response.body, /access_token|id_token|refresh_token/);
}
const config = await handler(request('/config.json'), {});
assert.equal(config.statusCode, 200);
assert.equal(JSON.parse(config.body).demo, false);
assert.equal(config.headers['cache-control'], 'no-store');
const api = await handler(request('/api/v1/catalogs'), {});
assert.equal(api.statusCode, 404, 'La Lambda web no sirve negocio');
console.log('SSR: HTML inicial, rutas profundas, config sin caché y separación de API correctos.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
