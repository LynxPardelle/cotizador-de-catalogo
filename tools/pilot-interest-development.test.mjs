import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,unlink,rmdir,symlink,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
const operator=await import('./pilot-interest-development.mjs').catch(()=>({}));
const context={stackName:'cotitrama-development',region:'us-east-1',outputs:{PublicUrl:'https://cotitrama-dev.lynxpardelle.com'}};
const table='cotitrama-development-InterestTable-example';
const now=new Date('2026-11-19T12:00:00.000Z');
const reference='11111111-1111-4111-8111-111111111111';
const record=(patch={})=>({PK:`INTEREST#${reference}`,SK:'RECORD',reference,status:'received',createdAt:'2026-11-18T12:00:00.000Z',expiresAt:Math.floor(now.getTime()/1000)+86400,record:{requestId:reference,contactEmail:'private@example.invalid',organizationName:'Private organization'},...patch});

test('interest table discovery accepts only the exact development stack, region and resource prefix',()=>{
  assert.equal(typeof operator.validateInterestTable,'function');
  assert.equal(operator.validateInterestTable(context,table),table);
  for(const [ctx,name] of [[{...context,stackName:'cotitrama-production'},table],[{...context,region:'us-west-2'},table],[context,'another-project-InterestTable-example'],[context,'cotitrama-development-QuotesTable-example'],[{...context,outputs:{PublicUrl:'https://other.invalid'}},table]]) assert.throws(()=>operator.validateInterestTable(ctx,name));
});

test('interest summaries omit contacts, expired entries, daily counters and mismatched references',()=>{
  assert.equal(typeof operator.summarizeInterest,'function');
  const summary=operator.summarizeInterest(record(),now);
  assert.deepEqual(summary,{reference,status:'received',createdAt:'2026-11-18T12:00:00.000Z',expiresAt:Math.floor(now.getTime()/1000)+86400});
  assert.ok(!JSON.stringify(summary).includes('private')&&!JSON.stringify(summary).includes('Private'));
  for(const item of [record({expiresAt:Math.floor(now.getTime()/1000)}),record({reference:'bad'}),record({PK:'DAILY#2026-11-19',SK:'COUNTER'}),record({createdAt:'not-a-date'}),record({PK:'INTEREST#22222222-2222-4222-8222-222222222222'})]) assert.equal(operator.summarizeInterest(item,now),undefined);
});

test('metadata listing uses a private-field-free projection, stops after ten pages and marks partial results',async()=>{
  assert.equal(typeof operator.listInterestSummaries,'function');
  const commands=[];
  const client={async send(command){commands.push(command);return {Items:[record()],ScannedCount:1,LastEvaluatedKey:{PK:`page-${commands.length}`,SK:'RECORD'}};}};
  const result=await operator.listInterestSummaries({client,table,now});
  assert.equal(commands.length,10);assert.equal(result.partial,true);assert.equal(result.scannedRows,10);assert.equal(result.pages,10);assert.equal(result.summaries.length,1);
  assert.ok(!JSON.stringify(result).includes('private@example.invalid'));
  for(const command of commands){assert.equal(command.constructor.name,'ScanCommand');assert.equal(command.input.TableName,table);assert.equal(command.input.ConsistentRead,true);assert.deepEqual(Object.values(command.input.ExpressionAttributeNames).sort(),['PK','SK','createdAt','expiresAt','reference','status'].sort());assert.ok(!/record|email|sector/i.test(command.input.ProjectionExpression));}
});

test('metadata listing limits scanned rows to five hundred, marks partiality and sorts summaries',async()=>{
  assert.equal(typeof operator.listInterestSummaries,'function');
  const limits=[];const second='22222222-2222-4222-8222-222222222222';
  const client={async send(command){limits.push(command.input.Limit);return limits.length===1 ? {Items:[record()],ScannedCount:300,LastEvaluatedKey:{PK:'next',SK:'RECORD'}} : {Items:[record({PK:`INTEREST#${second}`,reference:second,createdAt:'2026-11-19T10:00:00.000Z'})],ScannedCount:200,LastEvaluatedKey:{PK:'more',SK:'RECORD'}};}};
  const result=await operator.listInterestSummaries({client,table,now});
  assert.deepEqual(limits,[500,200]);assert.equal(result.scannedRows,500);assert.equal(result.partial,true);assert.deepEqual(result.summaries.map(item=>item.reference),[second,reference]);
});

test('completed metadata listing reports false partiality and does not return a pagination key',async()=>{
  assert.equal(typeof operator.listInterestSummaries,'function');
  const client={async send(){return {Items:[record(),record({expiresAt:1})],ScannedCount:2};}};
  const result=await operator.listInterestSummaries({client,table,now});
  assert.equal(result.partial,false);assert.equal(result.summaries.length,1);assert.ok(!Object.hasOwn(result,'LastEvaluatedKey'));
});

test('private export is a new exact-reference file under artifacts and never overwrites existing evidence',async(t)=>{
  assert.equal(typeof operator.writePrivateExport,'function');
  const projectRoot=await mkdtemp(join(tmpdir(),'cotitrama-interest-export-'));
  assert.equal(dirname(resolve(projectRoot)),resolve(tmpdir()));
  const directory=join(projectRoot,'artifacts');await mkdir(directory);
  const target=join(directory,`pilot-interest-${reference}-private.json`);
  t.after(async()=>{await unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});await rmdir(directory);await rmdir(projectRoot);});
  const path=await operator.writePrivateExport(record(),reference,{projectRoot,now});
  assert.equal(path,target);assert.equal(JSON.parse(await readFile(path,'utf8')).record.contactEmail,'private@example.invalid');
  await assert.rejects(operator.writePrivateExport(record(),reference,{projectRoot,now}));
  await assert.rejects(operator.writePrivateExport(record({expiresAt:1}),reference,{projectRoot,now}));
  await assert.rejects(operator.writePrivateExport(record(),'../other',{projectRoot,now}));
  await writeFile(path,'Existing evidence');
  await assert.rejects(operator.writePrivateExport(record(),reference,{projectRoot,now}));
  assert.equal(await readFile(path,'utf8'),'Existing evidence');
});

test('private export rejects an artifacts directory link without writing into its destination',async(t)=>{
  const projectRoot=await mkdtemp(join(tmpdir(),'cotitrama-interest-export-'));
  assert.equal(dirname(resolve(projectRoot)),resolve(tmpdir()));
  const directory=join(projectRoot,'artifacts'),destination=join(projectRoot,'linked-destination');await mkdir(destination);
  let linked=false;
  t.after(async()=>{if(linked){if(process.platform==='win32')await rmdir(directory);else await unlink(directory);}await rmdir(destination);await rmdir(projectRoot);});
  try {await symlink(destination,directory,process.platform==='win32'?'junction':'dir');linked=true;}
  catch(error){if(['EPERM','ENOTSUP'].includes(error.code)){t.skip('Host does not permit creating a directory link.');return;}throw error;}
  await assert.rejects(operator.writePrivateExport(record(),reference,{projectRoot,now}));
  await assert.rejects(access(join(destination,`pilot-interest-${reference}-private.json`)),{code:'ENOENT'});
});
