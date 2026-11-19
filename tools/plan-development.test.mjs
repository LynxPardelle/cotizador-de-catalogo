import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlanTarget } from './plan-development.mjs';

test('operator plan target accepts only a real organization with an administrator and a known plan', () => {
  const target = { organizationId: 'org-a123', planId: 'equipo', metadata: { PK: 'ORG#org-a123', SK: 'META', adminCount: 1 } };
  assert.equal(validatePlanTarget(target)?.id, 'equipo');
  for (const patch of [
    { organizationId: '../other' }, { planId: 'unlimited' },
    { metadata: undefined },
    { metadata: { ...target.metadata, PK: 'ORG#another' } },
    { metadata: { ...target.metadata, adminCount: 0 } },
    { metadata: { ...target.metadata, SK: 'MEMBER#person' } },
  ]) assert.throws(() => validatePlanTarget({ ...target, ...patch }));
});
