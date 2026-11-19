import assert from 'node:assert/strict';
import test from 'node:test';
const module=await import('./aws-smoke.mjs').catch(()=>({}));
const config={region:'us-east-1',parameters:{CertificateArn:'arn:aws:acm:us-east-1:123456789012:certificate/example'},environments:{development:{stackName:'cotitrama-development',domain:'cotitrama-dev.lynxpardelle.com',branch:'development'}}};
const stack={StackName:'cotitrama-development',StackId:'arn:aws:cloudformation:us-east-1:123456789012:stack/cotitrama-development/example',Outputs:[{OutputKey:'PublicUrl',OutputValue:'https://cotitrama-dev.lynxpardelle.com'},{OutputKey:'UserPoolId',OutputValue:'us-east-1_Example1'}]};
test('AWS smoke guard accepts only exact development stack, region, account and public origin',()=>{
  assert.equal(typeof module.validateDevelopmentStack,'function');
  assert.equal(module.validateDevelopmentStack(config,stack).UserPoolId,'us-east-1_Example1');
  for(const [configuration,target] of [
    [{...config,region:'eu-west-1'},stack],
    [config,{...stack,StackName:'cotitrama-production'}],
    [config,{...stack,StackId:stack.StackId.replace('123456789012','999999999999')}],
    [config,{...stack,Outputs:[{OutputKey:'PublicUrl',OutputValue:'https://cotitrama.lynxpardelle.com'}]}],
  ]) assert.throws(()=>module.validateDevelopmentStack(configuration,target));
});
test('cleanup guard rejects unrelated usernames, email, tenant group or pool',()=>{
  assert.equal(typeof module.validateQaManifest,'function');
  const runId='20261119-abcdef';
  const manifest={version:1,runId,stackName:'cotitrama-development',region:'us-east-1',userPoolId:'us-east-1_Example1',actors:{owner:{email:`ct-qa-owner-${runId}@example.invalid`,username:`ct-qa-owner-${runId}@example.invalid`,created:false,password:'never-in-report'},other:{email:`ct-qa-other-${runId}@example.invalid`,username:`ct-qa-other-${runId}@example.invalid`,created:false,password:'never-in-report'}}};
  assert.doesNotThrow(()=>module.validateQaManifest(manifest,{UserPoolId:'us-east-1_Example1'}));
  for(const mutate of [m=>m.userPoolId='us-east-1_Other',m=>m.actors.owner.email='real@example.com',m=>m.actors.owner.username='unrelated-account',m=>m.actors.owner.group='org:somebody:admin']) {
    const changed=structuredClone(manifest);mutate(changed);assert.throws(()=>module.validateQaManifest(changed,{UserPoolId:'us-east-1_Example1'}));
  }
});
