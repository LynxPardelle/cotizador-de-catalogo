import test from 'node:test';
import assert from 'node:assert/strict';
import { httpHandler } from './http.mjs';
import { HttpError } from './errors.mjs';

test('explicit service-unavailable errors preserve safe status and business code',async()=>{
  const handler=httpHandler(async()=>{throw new HttpError(503,'CATALOG_UNAVAILABLE','El catálogo no está disponible temporalmente.');});
  const response=await handler({requestContext:{requestId:'service-unavailable'}});
  assert.equal(response.statusCode,503);
  assert.equal(JSON.parse(response.body).error.code,'CATALOG_UNAVAILABLE');
});
test('untrusted server errors never expose infrastructure details',async()=>{
  const handler=httpHandler(async()=>{throw Object.assign(new Error('internal table ARN and query'),{statusCode:503,code:'PRIVATE_BACKEND_DETAIL'});});
  const response=await handler({requestContext:{requestId:'internal-error'}});
  assert.equal(response.statusCode,500);
  assert.equal(JSON.parse(response.body).error.code,'INTERNAL_ERROR');
  assert.ok(!response.body.includes('internal table'));
});
