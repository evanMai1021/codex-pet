'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {badgeVisibilityBounds}=require('../src/inori/core.cjs');
const body={x:60,y:340,width:180,height:176},chip={x:40,y:527,width:220,height:29};
for(const scale of [.8,1,1.2])test(`badge toggles preserve bottom and right anchors without drift at ${scale}`,()=>{
 const area={x:-1920,y:-200,width:1920,height:1080};
 const start={x:area.x+area.width-(chip.x+chip.width)*scale,y:area.y+area.height-(chip.y+chip.height)*scale,width:Math.round(300*scale),height:Math.round(560*scale)};
 let current=start;
 for(let i=0;i<10;i++){
  current=badgeVisibilityBounds(current,area,[body,chip],[body],scale);
  assert.ok(Math.abs(current.y+(body.y+body.height)*scale-area.y-area.height)<1);
  assert.ok(Math.abs(current.x+(body.x+body.width)*scale-area.x-area.width)<1);
  current=badgeVisibilityBounds(current,area,[body],[body,chip],scale);
  assert.ok(Math.abs(current.x-start.x)<1);assert.ok(Math.abs(current.y-start.y)<1);
 }
});
test('badge toggles do not move a freely placed pet in the middle',()=>{
 const area={x:0,y:0,width:1920,height:1080},rect={x:300,y:0,width:300,height:560};
 assert.deepEqual(badgeVisibilityBounds(rect,area,[body,chip],[body]),rect);
});
