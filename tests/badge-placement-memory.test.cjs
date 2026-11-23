'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBadgePlacementMemory}=require('../src/inori/badge-placement-memory.cjs');
test('badge avoidance can move temporarily and restores the exact original position',()=>{
 const m=createBadgePlacementMemory(),off={x:-1580,y:412},on={x:-1580,y:378};
 assert.equal(m.begin(true,off,'left-monitor'),null);
 for(let i=0;i<20;i++){
  assert.deepEqual(m.begin(false,on,'left-monitor'),off);
  assert.deepEqual(m.begin(true,off,'left-monitor'),on);
 }
});
test('manual movement and display or pose changes discard obsolete restoration targets',()=>{
 const m=createBadgePlacementMemory();m.begin(true,{x:1,y:2},'left');
 assert.equal(m.begin(false,{x:3,y:4},'right'),null);
 m.reset();assert.equal(m.begin(true,{x:5,y:6},'right'),null);
});
test('first toggle from visible also remembers its initial placement without shared references',()=>{
 const m=createBadgePlacementMemory(),on={x:30,y:40};m.begin(false,on,'same');on.y=999;
 const restore=m.begin(true,{x:30,y:70},'same');assert.deepEqual(restore,{x:30,y:40});restore.y=888;
 assert.deepEqual(m.begin(false,{x:30,y:40},'same'),{x:30,y:70});
});
