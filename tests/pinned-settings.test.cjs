'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validatePatch}=require('../src/inori/settings/schema.cjs');
test('pinned page is selected independently from automatic task visibility',()=>{
 for(const page of ['off','task','quota','usage'])assert.deepEqual(validatePatch({bubblePinnedPage:page,bubbleEnabled:false}),{bubblePinnedPage:page,bubbleEnabled:false});
 for(const page of ['always',true,null,1])assert.throws(()=>validatePatch({bubblePinnedPage:page}));
});
