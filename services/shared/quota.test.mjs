import test from 'node:test';
import assert from 'node:assert/strict';
const quota=await import('./quota.mjs').catch(()=>({}));

test('server plan defaults to Esencial and has independent immutable-by-caller limits',()=>{
  assert.equal(typeof quota.planFor,'function');
  const plan=quota.planFor();assert.deepEqual(plan,{id:'esencial',name:'Esencial',limits:{members:2,activeCatalogs:2,issuedQuotesPerMonth:100}});
  plan.limits.members=999;assert.equal(quota.planFor().limits.members,2);
  assert.equal(quota.planFor('equipo').limits.issuedQuotesPerMonth,1000);
  assert.equal(quota.planFor('empresa').limits.members,25);
  assert.throws(()=>quota.planFor('forged'),{code:'PLAN_UNAVAILABLE'});
});
test('usage warnings distinguish 80%, exact limit, overage and never negative remaining',()=>{
  assert.equal(typeof quota.usageMetric,'function');
  assert.deepEqual([0,79,80,99,100,101].map(used=>quota.usageMetric(used,100).state),['normal','normal','warning','warning','limit','over']);
  assert.deepEqual(quota.usageMetric(3,2),{used:3,limit:2,remaining:0,state:'over'});
  assert.equal(quota.quotaExceeded(quota.usageMetric(2,2)).code,'PLAN_LIMIT_REACHED');
  assert.equal(quota.quotaExceeded().statusCode,409);
  assert.throws(()=>quota.usageMetric(-1,2));assert.throws(()=>quota.usageMetric(1,0));
});
test('quote periods use UTC calendar months and return the next reset without a scheduled mutation',()=>{
  assert.equal(typeof quota.monthlyPeriod,'function');
  assert.deepEqual(quota.monthlyPeriod(new Date('2026-11-30T23:59:59-06:00')),{key:'2026-12',startsAt:'2026-12-01T00:00:00.000Z',resetsAt:'2027-01-01T00:00:00.000Z'});
});
