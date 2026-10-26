const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBubbleAnchor}=require('../src/inori/bubble-anchor.cjs');
const {placeBubble}=require('../src/inori/bubble-model.cjs');
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('bubble avoids full sprite envelope while tucked pet peeks out',()=>{
 const anchor=createBubbleAnchor()({x:700,y:0,width:300,height:560},{x:230,y:350,width:110,height:180,bubbleBounds:{x:108,y:330,width:276,height:208}},'right');
 const bubble=placeBubble(anchor,{x:0,y:0,width:1000,height:600});
 assert.ok(bubble);assert.ok(!overlaps(bubble,{x:808,y:330,width:192,height:208}));
});
test('screen clamp never pushes a bubble back onto the character',()=>{
 const area={x:0,y:0,width:500,height:400},anchor={x:120,y:150,width:260,height:240};
 const bubble=placeBubble(anchor,area,276,136);assert.ok(bubble);assert.ok(!overlaps(bubble,anchor));
});
test('no space means no bubble rather than covering the character',()=>{
 assert.equal(placeBubble({x:0,y:0,width:300,height:200},{x:0,y:0,width:300,height:200}),null);
});
