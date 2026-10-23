const test=require('node:test'),assert=require('node:assert/strict');
const {dockBounds,chooseDropEdge}=require('../src/inori/core.cjs');
for(const scale of [.8,1,1.2])for(const edge of ['top','bottom'])for(const end of ['left','right']){
 test(`horizontal dock reaches negative monitor ends: ${scale} ${edge} ${end}`,()=>{
  const area={x:-1600,y:-300,width:1600,height:1000},rect={x:end==='left'?-3000:3000,y:0,width:300*scale,height:560*scale};
  const regions=edge==='top'?[{x:80,y:0,width:140,height:180},{x:110,y:200,width:80,height:28}]:[{x:80,y:400,width:140,height:160},{x:110,y:350,width:80,height:28}];
  const b=dockBounds(rect,area,edge,regions,scale);assert.equal(b.y,edge==='top'?area.y:area.y+area.height-b.height);
  for(const r of regions){assert.ok(b.x+r.x*scale>=area.x-1);assert.ok(b.x+(r.x+r.width)*scale<=area.x+area.width+1);}
  assert.equal(b.width,rect.width);assert.equal(b.height,rect.height);
 });
}
test('top and bottom are preserved at corners only when explicitly preferred',()=>{
 const area={x:0,y:0,width:1920,height:1050};
 assert.equal(chooseDropEdge({x:-60,y:0,width:140,height:180},area,{x:0,y:60},24,'top'),'top');
 assert.equal(chooseDropEdge({x:1840,y:890,width:140,height:160},area,{x:1920,y:990},24,'bottom'),'bottom');
 assert.equal(chooseDropEdge({x:600,y:400,width:140,height:180},area,{x:670,y:490},24,'top'),null);
});
