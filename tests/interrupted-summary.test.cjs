const test=require('node:test');
const assert=require('node:assert/strict');
const {aggregate}=require('../src/inori/core.cjs');
const now=100000;
const interrupted={threadId:'stopped',turnId:'old-turn',state:'interrupted',label:'本轮已中断',terminalAt:now-6000,updatedAt:now-6000};
test('an old interrupted turn releases the global status to idle but retains evidence',()=>{
 const value=aggregate([interrupted],true,now);
 assert.equal(value.state,'idle');
 assert.equal(value.label,'待机');
 assert.equal(value.threads[0].state,'interrupted');
 assert.equal(value.threads[0].turnId,'old-turn');
});
test('an old interruption cannot hide a newer completion',()=>{
 assert.equal(aggregate([interrupted,{threadId:'new',state:'completed',updatedAt:now-1000}],true,now).state,'completed');
});
test('a recent interruption is visible for five seconds',()=>{
 for(const age of [0,4999,5000]) assert.equal(aggregate([{...interrupted,terminalAt:now-age}],true,now).state,'interrupted');
 assert.equal(aggregate([{...interrupted,terminalAt:now-5001}],true,now).state,'idle');
});
test('rollout updates cannot extend the interruption display',()=>{
 assert.equal(aggregate([{...interrupted,updatedAt:now}],true,now).state,'idle');
});
test('active work, waiting, errors and unknown sources remain visible',()=>{
 for(const state of ['working','waiting','error','unknown']) assert.equal(aggregate([interrupted,{state}],true,now).state,state);
 assert.equal(aggregate([interrupted],false,now).state,'unknown');
});
test('missing or future interruption timestamps never invent idle',()=>{
 for(const terminalAt of [undefined,null,NaN,0,now+1000]) assert.equal(aggregate([{...interrupted,terminalAt}],true,now).state,'interrupted');
});
