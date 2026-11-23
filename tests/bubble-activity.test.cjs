'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {taskBubble}=require('../src/inori/bubble-model.cjs');
const model=threads=>taskBubble({status:{state:'working',threadId:'one',threads}});
test('two active chats and one finished chat are counted as two, not three',()=>{
 const v=model([{threadId:'a',state:'working'},{threadId:'b',state:'waiting'},{threadId:'c',state:'completed'}]);
 assert.equal(v.count,2);assert.equal(v.uncertainCount,0);
});
test('ended, idle and unknown chats are never presented as confirmed activity',()=>{
 const v=model([{threadId:'a',state:'working'},{threadId:'b',state:'unknown'},{threadId:'c',state:'idle'},{threadId:'d',state:'error'},{threadId:'e',state:'interrupted'}]);
 assert.equal(v.count,1);assert.equal(v.uncertainCount,1);
});
test('counting deduplicates chat ids and excludes terminal records',()=>{
 const v=model([{threadId:'a',state:'working'},{threadId:'a',state:'working'},{threadId:'b',state:'unknown',terminalAt:123},{threadId:'c',state:'working',terminalAt:123}]);
 assert.equal(v.count,1);assert.equal(v.uncertainCount,0);
});
