import assert from 'node:assert/strict';
import test from 'node:test';
const module=await import('./local-server.mjs').catch(()=>({}));
test('local demo exposes only synthetic catalog and preserves emitted quote after republishing',async(t)=>{
  assert.equal(typeof module.createDemoServer,'function');
  const server=await module.createDemoServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const config=await (await fetch(`${base}/config.json`)).json();
  assert.equal(config.demo,true);
  const catalogs=await (await fetch(`${base}/api/v1/catalogs`)).json();
  assert.equal(catalogs.catalogs[0].catalogId,'oficina');
  const body={catalogId:'oficina',version:1,currency:'MXN',items:[{productId:'desk',quantity:5,optionIds:['oak']}]};
  const response=await fetch(`${base}/api/v1/quotes`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'demo-test'},body:JSON.stringify(body)});
  assert.equal(response.status,201);
  const quote=await response.json();
  assert.equal(quote.totalMinor,'2517500');
  const get=await fetch(`${base}/api/v1/quotes/${quote.quoteId}`);
  assert.deepEqual(await get.json(),quote);
});

test('local demo preserves metrics query windows and rejects duplicate days values',async(t)=>{
  const server=await module.createDemoServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const days of [7,90]) {
    const response=await fetch(`${base}/api/v1/quotes/metrics?days=${days}`);assert.equal(response.status,200);
    const metrics=await response.json();assert.equal(metrics.window.days,days);assert.equal(metrics.daily.length,days);
  }
  assert.equal((await fetch(`${base}/api/v1/quotes/metrics?days=7&days=90`)).status,400);
});

test('local demo accepts a public pilot-interest request and preserves its receipt on retry',async(t)=>{
  const server=await module.createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/v1/pilot-interest`;
  const body={requestId:'11111111-1111-4111-8111-111111111111',organizationName:'Organización ficticia',contactEmail:'demo-interest@example.invalid',sector:'Práctica',currentMethod:'spreadsheets',monthlyQuotes:'1-20',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'};
  for(let attempt=0;attempt<2;attempt++){const result=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(result.status,202);assert.deepEqual(await result.json(),{reference:body.requestId,status:'received'});}
  assert.equal((await fetch(base)).status,404);
});

test('loopback demo carries public intake into private review without changing its receipt',async(t)=>{
  const server=await module.createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/v1`,reference='22222222-2222-4222-8222-222222222222';
  const application={requestId:reference,organizationName:'Taller ficticio local',contactEmail:'local-review@example.invalid',sector:'Práctica',currentMethod:'manual',monthlyQuotes:'1-20',twoParticipants:'not-sure',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'};
  const post=()=>fetch(`${base}/pilot-interest`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(application)});
  assert.equal((await post()).status,202);
  assert.deepEqual(await (await fetch(`${base}/pilot-applications/context`)).json(),{allowed:true});
  const list=await (await fetch(`${base}/pilot-applications?status=received`)).json();assert.equal(list.items[0].reference,reference);assert.ok(!JSON.stringify(list).includes(application.contactEmail));
  const update={mutationId:'33333333-3333-4333-8333-333333333333',expectedVersion:0,status:'reviewing',nextActionDate:'2026-12-01',note:'Práctica local de seguimiento.'};
  const changed=await fetch(`${base}/pilot-applications/${reference}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(update)});assert.equal(changed.status,200);
  const detail=await (await fetch(`${base}/pilot-applications/${reference}`)).json();assert.equal(detail.review.version,1);assert.equal(detail.application.contactConsent,true);assert.equal(detail.application.status,'received');
  const history=await (await fetch(`${base}/pilot-applications/${reference}/history`)).json();assert.equal(history.items.length,1);assert.equal(history.items[0].note,update.note);
  assert.deepEqual(await (await post()).json(),{reference,status:'received'});
});

test('loopback demo links a preselected contact and checks its published catalog without inventing seller access',async(t)=>{
  const server=await module.createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/v1`,reference='44444444-4444-4444-8444-444444444444';
  const send=(path,body,method='POST')=>fetch(base+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const application={requestId:reference,organizationName:'Piloto ficticio local',contactEmail:'demo@example.invalid',sector:'Práctica',currentMethod:'manual',monthlyQuotes:'1-20',twoParticipants:'yes',timeAvailability:'yes',contactConsent:true,privacyVersion:'2026-11-19'};
  assert.equal((await send('/pilot-interest',application)).status,202);
  assert.equal((await send(`/pilot-applications/${reference}`,{mutationId:'55555555-5555-4555-8555-555555555555',expectedVersion:0,status:'selected',nextActionDate:'',note:''},'PATCH')).status,200);
  const contextResponse=await fetch(`${base}/pilot-onboarding/${reference}`);assert.equal(contextResponse.status,200);const context=await contextResponse.json();assert.ok(context.adminWorkspaces.some(workspace=>workspace.workspaceId==='demo'));
  const linked=await send(`/pilot-onboarding/${reference}/link`,{mutationId:'66666666-6666-4666-8666-666666666666',expectedVersion:0,workspaceId:'demo',participationConsent:true,sharingConsent:true,consentVersion:'2026-11-19'});assert.equal(linked.status,200);
  const catalog=await send(`/pilot-onboarding/${reference}/catalog`,{mutationId:'77777777-7777-4777-8777-777777777777',expectedVersion:1,catalogId:'oficina',version:1,catalogAuthorized:true,consentVersion:'2026-11-19'});assert.equal(catalog.status,200);
  const preparation=await (await fetch(`${base}/pilot-applications/${reference}/preparation`)).json();assert.equal(preparation.readiness.catalog.ready,true);assert.equal(preparation.readiness.access.adminReady,true);assert.equal(preparation.readiness.access.sellerReady,false);assert.notEqual(preparation.readiness.state,'ready');assert.ok(!JSON.stringify(preparation).includes('basePriceMinor'));
  assert.deepEqual(await (await send('/pilot-interest',application)).json(),{reference,status:'received'});
});
