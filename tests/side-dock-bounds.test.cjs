const test=require('node:test'),assert=require('node:assert/strict');
const {dockBounds,chooseDropEdge}=require('../src/inori/core.cjs');
for(const scale of [.8,1,1.2])for(const edge of ['left','right'])for(const y of [-3000,3000]){
 test(`side bounds preserve visible content on negative monitor: ${scale} ${edge} ${y}`,()=>{
  const area={x:-1600,y:-300,width:1600,height:1000},rect={x:-800,y,width:300*scale,height:560*scale},regions=[{x:20,y:368,width:130,height:150},{x:90,y:532,width:120,height:28}];
  const b=dockBounds(rect,area,edge,regions,scale);
  assert.equal(b.x,edge==='left'?area.x:area.x+area.width-b.width);
  for(const r of regions){assert.ok(b.y+r.y*scale>=area.y-1);assert.ok(b.y+(r.y+r.height)*scale<=area.y+area.height+1);}
  assert.equal(b.width,rect.width);assert.equal(b.height,rect.height);
 });
}
const area={x:0,y:0,width:1920,height:1050};
test('existing side wins at a corner only when explicitly preferred',()=>{
 const pet={x:0,y:-50,width:120,height:180},cursor={x:60,y:0};
 assert.equal(chooseDropEdge(pet,area,cursor),'top');
 assert.equal(chooseDropEdge(pet,area,cursor,24,'left'),'left');
});
test('preferred side cannot latch after the pet is dragged away',()=>{
 assert.equal(chooseDropEdge({x:600,y:300,width:120,height:180},area,{x:660,y:390},24,'left'),null);
});
