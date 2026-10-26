const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBubbleAnchor}=require('../src/inori/bubble-anchor.cjs');
test('stable visible envelope ignores frame ink and updates when pet changes pose',()=>{
 const anchor=createBubbleAnchor(),bounds={x:0,y:0,width:300,height:560},envelope={x:180,y:350,width:100,height:180};
 const first=anchor(bounds,{x:190,y:360,width:80,height:160,bubbleBounds:envelope},'right');
 assert.deepEqual(anchor(bounds,{x:192,y:365,width:75,height:150,bubbleBounds:envelope},'right'),first);
 assert.notDeepEqual(anchor(bounds,{bubbleBounds:{...envelope,x:130,width:145}},'right'),first);
});
test('animation ink changes never move bubble; real window movement translates it',()=>{
 const anchor=createBubbleAnchor(),bounds={x:100,y:100,width:300,height:560};
 const first=anchor(bounds,{x:80,y:330,width:100,height:180},'redwhite/free');
 for(let i=0;i<30;i++)assert.deepEqual(anchor(bounds,{x:70+i,y:320+i,width:90+i,height:170+i},'redwhite/free'),first);
 assert.deepEqual(anchor({...bounds,x:150,y:160},{x:99,y:350,width:90,height:190},'redwhite/free'),{...first,x:first.x+50,y:first.y+60});
});
test('wait for geometry, reset only on outfit, dock or window size change',()=>{
 const anchor=createBubbleAnchor(),bounds={x:0,y:0,width:300,height:560},body={x:80,y:330,width:100,height:180};
 assert.equal(anchor(bounds,null,'a'),null);const first=anchor(bounds,body,'a');
 assert.notDeepEqual(anchor(bounds,{...body,x:0},'b'),first);
 assert.equal(anchor({...bounds,width:240},body,'b').width,80);
});
