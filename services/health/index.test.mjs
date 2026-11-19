import assert from 'node:assert/strict';
import test from 'node:test';
import { handler } from './index.mjs';

test('reports liveness without returning request data', async () => {
  const response = await handler({ body: 'ignored-request-payload' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(response.body), { status: 'ok', service: 'cotitrama' });
});
