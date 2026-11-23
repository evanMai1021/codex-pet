'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {placeBubble}=require('../src/inori/bubble-model.cjs');
const {validatePatch}=require('../src/inori/settings/schema.cjs');
const area={x:-1000,y:-100,width:2400,height:1600},anchor={x:0,y:400,width:150,height:180};
test('preferred sides and signed offsets follow the character without changing size',()=>{
 const expected={right:{x:160,y:440},left:{x:-210,y:440},top:{x:-25,y:290},bottom:{x:-25,y:590}};
 for(const [side,xy] of Object.entries(expected)){
  const dx=side==='left'?-20:20,dy=side==='bottom'?15:-15;
  const options={bubblePosition:side,bubbleOffsetX:dx,bubbleOffsetY:dy};
  assert.deepEqual(placeBubble(anchor,area,200,100,[],options),{x:xy.x+dx,y:xy.y+dy,width:200,height:100});
  const moved=placeBubble({...anchor,x:anchor.x+70,y:anchor.y+30},area,200,100,[],options);
  assert.deepEqual(moved,{x:xy.x+dx+70,y:xy.y+dy+30,width:200,height:100});
 }
 assert.deepEqual(placeBubble(anchor,area),placeBubble(anchor,area,276,136,[],{bubblePosition:'auto',bubbleOffsetX:0,bubbleOffsetY:0}));
});
test('edge, impossible offset and obstacles preserve on-screen non-overlapping placement',()=>{
 const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 for(const scale of [.8,1,1.2,1.4])for(const side of ['auto','left','right','top','bottom'])for(const x of [-900,0,1250]){
  const a={...anchor,x},obstacle={x:200,y:200,width:100,height:100};
  const b=placeBubble(a,area,300*scale,328*scale,[obstacle],{bubblePosition:side,bubbleOffsetX:-400,bubbleOffsetY:400});
  assert.ok(b);assert.ok(!overlaps(b,a)&&!overlaps(b,obstacle));
  assert.ok(b.x>=area.x&&b.y>=area.y&&b.x+b.width<=area.x+area.width&&b.y+b.height<=area.y+area.height);
 }
 assert.equal(placeBubble({x:0,y:0,width:300,height:200},{x:0,y:0,width:300,height:200},276,136,[],{bubblePosition:'top',bubbleOffsetY:-400}),null);
});
test('position updates reject invalid and nonfinite offsets atomically',()=>{
 assert.deepEqual(validatePatch({bubblePosition:'left',bubbleOffsetX:-400,bubbleOffsetY:400}),{bubblePosition:'left',bubbleOffsetX:-400,bubbleOffsetY:400});
 for(const v of [null,'20',NaN,Infinity,-401,401])assert.throws(()=>validatePatch({bubblePosition:'left',bubbleOffsetX:v}));
 assert.throws(()=>validatePatch({bubblePosition:'outside'}));
});
