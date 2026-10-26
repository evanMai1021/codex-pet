'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/inori/renderer/animation.js'),'utf8'),ctx);const anim=ctx.InoriAnimation;
for(const skin of ['redwhite','battle']){
 const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../src/inori/assets',skin,'manifest.json'),'utf8'));
 test(skin+' new idle phases use source frames and preserve trigger times',()=>{
  assert.equal(anim.sampleAsset(manifest,'idle',0,59999).clip,'continuousIdle');
  assert.equal(anim.sampleAsset(manifest,'idle',0,60000).clip,'continuousStretch');
  assert.equal(anim.sampleAsset(manifest,'idle',0,61799).frame,15);
  const stretchEnd=60000+(manifest.videos?.stretch?.durationMs||1800);
  assert.equal(anim.sampleAsset(manifest,'idle',0,stretchEnd-1).clip,'continuousStretch');
  assert.equal(anim.sampleAsset(manifest,'idle',0,stretchEnd).clip,'continuousIdle');
  assert.equal(anim.sampleAsset(manifest,'idle',0,61800,true).clip,'continuousIdle');
  assert.equal(anim.sampleAsset(manifest,'idle',0,120200).clip,'continuousDoze');
  assert.equal(anim.sampleAsset(manifest,'idle',0,120200).frame,1);
  assert.equal(anim.sampleAsset(manifest,'idle',0,120200,true).frame,7);
 });
 test(skin+' sleep entry plays once then breathing loops without standing again',()=>{
  assert.equal(anim.sampleAsset(manifest,'idle',0,300000).clip,'continuousSleepEnter');
  assert.equal(anim.sampleAsset(manifest,'idle',0,301279).frame,7);
  assert.equal(anim.sampleAsset(manifest,'idle',0,301280).clip,'continuousSleepLoop');
  assert.equal(anim.sampleAsset(manifest,'idle',0,301530).frame,1);
  assert.equal(anim.sampleAsset(manifest,'idle',0,303280).frame,0);
  assert.equal(anim.sampleAsset(manifest,'idle',0,300000,true).clip,'continuousSleepLoop');
 });
 test(skin+' new peace and unknown preserve interaction and status semantics',()=>{
  assert.equal(manifest.clips.peace.frames.length,16);assert.equal(anim.interaction('peace',1485),null);
  const unknown=anim.sampleAsset(manifest,'unknown',150);assert.equal(unknown.clip,'continuousUnknown');assert.equal(unknown.question,true);
 });
 test(skin+' all dock frames animate inside their canvas and top derives from bottom',()=>{
  for(const edge of ['left','right','bottom','top']){
   const first=anim.dockLayout(manifest.dock,edge,0),next=anim.dockLayout(manifest.dock,edge,180),reduced=anim.dockLayout(manifest.dock,edge,180,true);
   assert.notDeepEqual(first.source,next.source);assert.deepEqual(first.source,reduced.source);
   for(let i=0;i<16;i++){const f=anim.dockLayout(manifest.dock,edge,i*180),[l,t,r,b]=f.box;assert.ok((r-l)*f.scale<=184.01);assert.ok((b-t)*f.scale<=190.01);}
  }
  assert.deepEqual(anim.dockLayout(manifest.dock,'top',180).source,anim.dockLayout(manifest.dock,'bottom',180).source);
  assert.equal(anim.dockLayout(manifest.dock,'top',180).rotate,true);
 });
}
