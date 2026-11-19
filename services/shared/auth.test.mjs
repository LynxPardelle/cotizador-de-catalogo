import assert from 'node:assert/strict';
import test from 'node:test';
const module = await import('./auth.mjs').catch(() => ({}));

const event = (groups, extra = {}) => ({requestContext: {authorizer: {jwt: {claims: {sub: 'person-1', token_use: 'access', 'cognito:groups': groups, ...extra}}}}});
test('takes organization and role only from verified access-token groups', () => {
  assert.equal(typeof module.identity, 'function');
  assert.deepEqual(module.identity(event('["org:demo:admin"]')), {subject: 'person-1', organizationId: 'demo', role: 'admin'});
  assert.deepEqual(module.identity(event(['org:acme:seller'])), {subject: 'person-1', organizationId: 'acme', role: 'seller'});
  assert.deepEqual(module.identity(event('[org:acme:seller]')), {subject: 'person-1', organizationId: 'acme', role: 'seller'});
});
test('rejects anonymous, ID tokens and ambiguous organization memberships', () => {
  assert.equal(typeof module.identity, 'function');
  for (const input of [{}, event(['org:a:reader'], {token_use: 'id'}), event(['org:a:admin', 'org:b:admin']), event(['admin']), event(['org:a:admin'], {sub: ''})]) {
    assert.throws(() => module.identity(input), error => error.statusCode === 401 || error.statusCode === 403);
  }
});
test('reader cannot issue and seller cannot publish', () => {
  assert.equal(typeof module.requireRole, 'function');
  assert.throws(() => module.requireRole({role: 'reader'}, ['admin', 'seller']), {statusCode: 403});
  assert.throws(() => module.requireRole({role: 'seller'}, ['admin']), {statusCode: 403});
});
