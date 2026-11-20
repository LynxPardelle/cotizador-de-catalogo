import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('./pilot-reviewer-development.mjs').catch(()=>({}));
const user={Username:'11111111-1111-4111-8111-111111111111',Enabled:true,UserStatus:'CONFIRMED',UserAttributes:[{Name:'sub',Value:'11111111-1111-4111-8111-111111111111'},{Name:'email',Value:'operator@example.invalid'},{Name:'email_verified',Value:'true'}]};
test('reviewer grant targets only the explicitly named enabled confirmed verified account',()=>{
 assert.equal(typeof module.reviewerTarget,'function');assert.doesNotThrow(()=>module.reviewerTarget('operator@example.invalid',user,true));
 for(const altered of [{...user,Enabled:false},{...user,UserStatus:'UNCONFIRMED'},{...user,UserAttributes:user.UserAttributes.filter(x=>x.Name!=='email_verified')}])assert.throws(()=>module.reviewerTarget('operator@example.invalid',altered,true));
 assert.throws(()=>module.reviewerTarget('another@example.invalid',user,true));
});
test('revoking access does not require the target account to remain enabled or verified',()=>{
 assert.equal(typeof module.reviewerTarget,'function');assert.doesNotThrow(()=>module.reviewerTarget('operator@example.invalid',{...user,Enabled:false,UserStatus:'UNCONFIRMED'},false));
});
test('reviewer operations reject another project environment and never expose arbitrary group selection',()=>{
 assert.equal(typeof module.validateReviewerContext,'function');const context={stackName:'cotitrama-development',region:'us-east-1',outputs:{PublicUrl:'https://cotitrama-dev.lynxpardelle.com',UserPoolId:'us-east-1_Example1'}};
 assert.doesNotThrow(()=>module.validateReviewerContext(context));
 assert.throws(()=>module.validateReviewerContext({...context,stackName:'other-project'}));assert.throws(()=>module.validateReviewerContext({...context,region:'us-west-2'}));
 assert.equal(module.REVIEWER_GROUP,'cotitrama-pilot-reviewers');
});
