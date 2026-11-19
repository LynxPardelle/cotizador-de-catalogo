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
