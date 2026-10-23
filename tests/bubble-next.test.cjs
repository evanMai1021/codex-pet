const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {taskBubble,placeBubble,bubbleHeadline,bubblePhraseGroups}=require('../src/inori/bubble-model.cjs');
test('headlines cycle by tone and append custom text without changing real status',()=>{
 const model=taskBubble({status:{state:'waiting',approvalPending:true,title:'检查安装包'}}),copy=JSON.stringify(model);
 assert.notEqual(bubbleHeadline(model,{},0),bubbleHeadline(model,{},1));
 assert.equal(bubbleHeadline(model,{bubbleCustomLine:'陪我一起完成吧♡'},4),'陪我一起完成吧♡');
 assert.equal(bubbleHeadline(model,{bubbleTone:'affectionate'},0),bubbleHeadline(model,{bubbleTone:'cute'},0));
 assert.equal(bubbleHeadline(model,{bubbleTone:'invalid'},0),bubbleHeadline(model,{},0));
 assert.equal(JSON.stringify(model),copy);assert.equal(model.label,'需要你批准');
});
test('settings phrase browser shares the exact combined runtime phrases',()=>{
 const groups=bubblePhraseGroups({bubbleTone:'cute',bubbleCustomLine:'我的短句♡'});
 assert.equal(groups.length,7);
 const work=groups.find(g=>g.id==='working');assert.ok(work.lines.includes('正在认真想下一步呢～'));assert.ok(work.lines.includes('陪我把这一步做好嘛♡'));
 for(const group of groups){const model={state:['approval','input'].includes(group.id)?'waiting':group.id,approval:group.id==='approval'};group.lines.forEach((line,i)=>assert.equal(line,bubbleHeadline(model,{bubbleTone:'cute',bubbleCustomLine:'我的短句♡'},i)));}
 assert.ok(!groups.find(g=>g.id==='input').lines.some(s=>s.includes('点点头')));
 assert.ok(groups.find(g=>g.id==='approval').lines.some(s=>s.includes('点点头')));
});
test('bubble uses task title and public phase, never hidden reasoning',()=>{
 const v=taskBubble({status:{state:'working',title:'修复地图加载',phase:'正在验证',analysis:'secret reasoning',threads:[{}]}});
 assert.equal(v.title,'修复地图加载');assert.equal(v.progress,'正在验证');assert.ok(!JSON.stringify(v).includes('secret reasoning'));
});
test('approval requires explicit current evidence',()=>{
 assert.equal(taskBubble({status:{state:'waiting',approvalPending:true}}).label,'需要你批准');
 assert.equal(taskBubble({status:{state:'waiting'}}).approval,false);
 assert.equal(taskBubble({status:{state:'unknown',threadId:'1',approvalPending:true}}).approval,false);
 assert.equal(taskBubble({status:{state:'idle'}}).visible,false);
});
test('public summary and action are separate; quota is not duplicated in the bubble',()=>{
 const v=taskBubble({quota:{windows:[{remaining:60}]},status:{state:'working',title:'检查安装包',phase:'正在验证',publicProgress:'正在核对文件大小和版本',analysis:'private'}});
 assert.equal(v.stage,'正在验证');assert.equal(v.progress,'正在核对文件大小和版本');assert.equal(v.action,'');
 assert.ok(!Object.hasOwn(v,'quota'));assert.ok(!JSON.stringify(v).includes('private'));
 assert.match(taskBubble({status:{state:'waiting',approvalPending:true}}).action,/批准/);
});
test('bubble placement remains inside every monitor edge without changing anchor',()=>{
 const area={x:-1920,y:0,width:1920,height:1080};
 for(const anchor of [{x:-1910,y:0,width:150,height:180},{x:-160,y:900,width:150,height:180}]){
  const copy={...anchor},r=placeBubble(anchor,area);assert.deepEqual(anchor,copy);
  assert.ok(r.x>=area.x&&r.y>=area.y&&r.x+r.width<=0&&r.y+r.height<=1080);
 }
});
test('continuous asset timelines use source frame duration and loop correctly',()=>{
 const ctx={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/inori/renderer/animation.js'),'utf8'),ctx);
 const manifest={stateMap:{working:'work'},clips:{work:{frameMs:1000/24,loop:true,frames:Array(48).fill({})}}};
 const sample=ctx.InoriAnimation.sampleAsset;assert.equal(sample(manifest,'working',1000).frame,24);
 assert.equal(sample(manifest,'working',2000).frame,0);assert.equal(sample(manifest,'working',1000,0,true).frame,0);
});
test('continuous idle preserves original stretch, doze and sleep actions',()=>{
 const ctx={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/inori/renderer/animation.js'),'utf8'),ctx);
 const manifest={stateMap:{idle:'continuousIdle'},clips:{continuousIdle:{frameMs:125,loop:true,frames:Array(16).fill({})}}},sample=ctx.InoriAnimation.sampleAsset;
 assert.equal(sample(manifest,'idle',1000,1000).clip,'continuousIdle');
 assert.equal(sample(manifest,'idle',1000,60000).clip,'stretch');
 assert.equal(sample(manifest,'idle',1000,120000).phase,'doze');
 assert.equal(sample(manifest,'idle',1000,300000).phase,'sleep');
});
test('video path uses one lazy decoder and stops for reduced motion or missing state',()=>{
 let created=0,paused=0;const context={document:{createElement:()=>{created++;return {readyState:2,currentTime:0,play:()=>Promise.resolve(),pause:()=>paused++,removeAttribute(){},load(){}};}}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/inori/renderer/video-animation.js'),'utf8'),context);
 const player=new context.InoriVideoAnimation(),manifest={videos:{working:{file:'videos/work.webm'}}};
 assert.ok(player.frame('a',manifest,'working','../assets/',true));assert.ok(player.frame('a',manifest,'working','../assets/',true));assert.equal(created,1);
 assert.equal(player.frame('a',manifest,'working','../assets/',false),null);assert.equal(paused,1);
 assert.equal(player.frame('a',{videos:{working:{file:'../private.webm'}}},'working','../assets/',true),null);assert.equal(created,1);
});
