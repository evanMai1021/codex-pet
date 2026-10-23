'use strict';
const $=id=>document.getElementById(id),scene=$('scene'),avatar=$('avatar'),panel=$('panel'),chip=$('chip');
const ctx=$('sprite').getContext('2d');
ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
let lastPaintKey='',lastRegionKey='',paintCount=0,readbackCount=0;
const videoAnimation=new window.InoriVideoAnimation();
window.addEventListener('beforeunload',()=>videoAnimation.stop());
const rows={idle:[0,6,180],working:[7,6,280],waiting:[6,6,320],completed:[4,5,160],error:[5,8,160],interrupted:[8,6,180],unknown:[8,6,220],wave:[3,4,180]};
const anim=window.InoriAnimation;let skin=window.InoriAssets,skinImages={},skinReady=false,skinError=null,activeSkin=null,pendingSkin=null,loadToken=0,activeClick='wave',clickStartedAt=0,stateKey='';
const candidates=Object.fromEntries(['left','right','top','bottom','sleep','stretch'].map(k=>[k,true]));
const skinCatalog={redwhite:{manifest:window.InoriAssets,base:'../assets/redwhite/'},battle:{manifest:window.InoriBattleAssets,base:'../assets/battle/'}};
const skinCache=new Map();
function loadSkin(requested){
 const id=Object.hasOwn(skinCatalog,requested)?requested:'redwhite';
 if(activeSkin===id){if(pendingSkin){++loadToken;pendingSkin=null;}return;}
 if(pendingSkin===id)return;
 pendingSkin=id;const token=++loadToken,entry=skinCatalog[id];
 if(!skinCache.has(id)){
  const manifest=entry.manifest,images={};
  const files=[...Object.entries(manifest.clips).map(([k,v])=>[k,v.image]),...Object.entries(manifest.additionalImages||{}),...Object.entries(manifest.dock.images||{dock:manifest.dock.image})];
  skinCache.set(id,Promise.all(files.map(([key,file])=>new Promise((resolve,reject)=>{
   const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>reject(Error('服装资源未加载：'+file));im.src=entry.base+file;
  }))).then(()=>({manifest,images})));
 }
 skinCache.get(id).then(bundle=>{
  if(token!==loadToken)return;
  skin=bundle.manifest;skinImages=bundle.images;activeSkin=id;pendingSkin=null;skinReady=true;skinError=null;frameStart=Date.now();overlayUntil=0;avatar.title='';paint();layout();
 }).catch(error=>{if(token!==loadToken)return;pendingSkin=null;skinCache.delete(id);skinError=error.message;avatar.title=skinError;});
}
let data={status:{state:'unknown',threads:[]},quota:{health:'connecting',windows:[]},lastInteraction:Date.now(),dock:null},idleSince=Date.now(),lastState='unknown',overlayUntil=0,frameStart=Date.now(),petHover=false,pinned=false,press=null,clickTimer,lastRelease=0;
function visibleQuota(){return ['ok','stale','preview'].includes(data.quota.health);}
function formatTime(seconds){return seconds?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(seconds*1000)):'未知';}
function renderQuota(){
 const q=data.quota,show=visibleQuota(),windows=show?q.windows:[];
 $('compact').textContent=windows.length?windows.map(w=>`${w.label} ${Math.round(w.remaining)}%`).join(' · '):({unverified:'额度 · 核对账户',connecting:'额度连接中',unavailable:'额度未连接','account-mismatch':'账户已变化'}[q.health]??'额度未知');
 $('quota-detail').replaceChildren();
 if(windows.length)for(const w of windows){const row=document.createElement('div');row.className='quota-row';const title=document.createElement('div');title.className='quota-title';const label=document.createElement('span');label.textContent=w.label+'剩余';const value=document.createElement('strong');value.textContent=Math.round(w.remaining)+'%';title.append(label,value);const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('span');fill.style.width=Math.max(0,Math.min(100,w.remaining))+'%';bar.append(fill);const reset=document.createElement('div');reset.className='reset';reset.textContent='重置 '+formatTime(w.resetsAt)+' · 香港时间';row.append(title,bar,reset);$('quota-detail').append(row);}
 else{const p=document.createElement('p');p.textContent=q.health==='unverified'?'请核对下面的账户，确认后展示官方额度。':'暂时无法取得已核对账户的额度。';$('quota-detail').append(p);}
 $('account-label').textContent=q.accountLabel?'官方账户：'+q.accountLabel:'';
 $('confirm').hidden=!q.fingerprint||(q.health!=='unverified'&&q.health!=='account-mismatch');
 $('updated').textContent=q.updatedAt?'更新于 '+formatTime(q.updatedAt/1000)+(q.health==='stale'?' · 更新失败，显示上次快照':''):'';
 if(q.health==='preview')$('updated').textContent='模拟额度 · 仅界面验收';
}
function apply(value){
 data=value;loadSkin(value.skin??'redwhite');const state=value.status.state;const nextKey=state+':'+(value.status.turnId??'');if(nextKey!==stateKey){stateKey=nextKey;frameStart=Date.now();}
 if(state!=='idle'||lastState!=='idle')idleSince=Date.now();
 lastState=state;scene.dataset.state=state;scene.dataset.dock=value.dock??'free';scene.classList.toggle('reduced',!!value.reduced);
 $('state-label').textContent=value.status.label??'状态未知';
 $('thread-label').textContent=value.status.threadId?(value.status.title||'未命名聊天')+(value.status.threads.length>1?` · ${value.status.threads.length} 个聊天状态`:''):'';
 $('thread-label').title=value.status.title||'';
 $('phase-label').textContent=state==='working'?(value.status.phase||'正在处理'):'';
 $('phase-label').hidden=!$('phase-label').textContent;
 $('capability').textContent=value.capabilities?.desktopStatusExperimental?(value.capabilities.desktopStatusConnected?'审批等待：试接入，尚未验收':'桌面状态暂不可用 · 审批状态未知'):(value.capabilities?.approval?'审批等待：已接入':'本地状态记录 · 审批等待未验证');
 renderQuota();layout();paint();
}
function layout(){const scale=innerWidth/300;scene.style.transform=`scale(${scale})`;panel.hidden=!pinned;requestAnimationFrame(reportRegions);}
let ink={x:48,y:20,width:96,height:180};
function reportRegions(){if(!skinReady)return;const scale=innerWidth/300,r=avatar.getBoundingClientRect();
 const body={kind:'body',skinId:activeSkin,x:r.left/scale+ink.x,y:r.top/scale+ink.y,width:ink.width,height:ink.height};
 const regions=[body,...[...(data.dock&&scene.classList.contains('peek')?[avatar]:[]),chip,...(!panel.hidden?[panel]:[])].map(el=>{const r=el.getBoundingClientRect();return{kind:el===panel?'panel':el===chip?'chip':'hit',x:Math.max(0,r.left/scale),y:Math.max(0,r.top/scale),width:Math.max(0,Math.min(innerWidth,r.right)/scale-Math.max(0,r.left/scale)),height:Math.max(0,Math.min(innerHeight,r.bottom)/scale-Math.max(0,r.top/scale))};})];const signature=JSON.stringify(regions);if(signature!==lastRegionKey){lastRegionKey=signature;window.inori.regions(regions);}
}
function measureInk(){const a=ctx.getImageData(0,0,192,208).data;let x0=192,y0=208,x1=0,y1=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(a[(y*192+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}if(x1>x0)ink={x:x0,y:y0,width:x1-x0,height:y1-y0};}
function interaction(){if(Date.now()<overlayUntil)return;window.inori.interact();idleSince=Date.now();activeClick=Math.random()<.5?'wave':'peace';clickStartedAt=Date.now();overlayUntil=clickStartedAt+anim.duration(activeClick);}
avatar.addEventListener('pointerdown',e=>{if(e.button!==0)return;press={x:e.screenX,y:e.screenY,dragged:false};avatar.setPointerCapture(e.pointerId);window.inori.press();});
avatar.addEventListener('pointermove',e=>{if(!press)return;if(Math.hypot(e.screenX-press.x,e.screenY-press.y)>6)press.dragged=true;if(press.dragged){clearTimeout(clickTimer);pinned=false;layout();scene.classList.add('dragging');window.inori.drag();}});
avatar.addEventListener('pointerup',()=>{if(!press)return;const dragged=press.dragged;press=null;scene.classList.remove('dragging');window.inori.release();if(dragged){lastRelease=0;return;}clearTimeout(clickTimer);const now=Date.now();if(lastRelease&&now-lastRelease<=300){lastRelease=0;pinned=!pinned;layout();}else{lastRelease=now;clickTimer=setTimeout(()=>{lastRelease=0;interaction();},300);}});
avatar.addEventListener('dblclick',()=>{clearTimeout(clickTimer);});
avatar.addEventListener('pointercancel',()=>{press=null;scene.classList.remove('dragging');window.inori.release();});
avatar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();interaction();}});
chip.addEventListener('click',()=>{pinned=!pinned;layout();});
document.addEventListener('contextmenu',e=>{e.preventDefault();window.inori.menu();});
scene.addEventListener('pointermove',e=>{if(press)return;const onPet=!!e.target.closest('#avatar,#chip,#panel');if(onPet!==petHover){petHover=onPet;window.inori.hover(onPet);}});
scene.addEventListener('pointerleave',()=>{petHover=false;window.inori.hover(false);});
$('close').addEventListener('click',()=>{pinned=false;layout();});
$('refresh').addEventListener('click',()=>window.inori.refresh());$('confirm').addEventListener('click',()=>window.inori.confirmAccount(data.quota.fingerprint));
window.addEventListener('resize',layout);window.inori.onSnapshot(apply);window.inori.get().then(apply);
let lastDraw=0;
function paint(){if(!skinReady)return;
 const now=Date.now(),state=data.status.state,idleMs=Math.max(0,now-Math.max(idleSince,data.lastInteraction??0)),elapsed=Math.max(0,now-frameStart),reacting=now<overlayUntil;
 const peeking=!!data.dock&&(reacting||(!!data.peek&&['waiting','error'].includes(state))||(state==='completed'&&elapsed<2000));
 scene.classList.toggle('peek',peeking);const pose=data.dock&&!peeking?data.dock:null;scene.classList.toggle('candidate-pose',!!pose);
 let sample=reacting?anim.interaction(activeClick,now-clickStartedAt,!!data.reduced):null;sample=sample||anim.sampleAsset(skin,state,elapsed,idleMs,!!data.reduced);
 scene.dataset.animation=pose?'dock-'+pose:sample.clip;scene.dataset.idlePhase=state==='idle'?(sample.phase||'awake'):'awake';
 const frame=skin.clips[sample.clip].frames[sample.frame];
 const videoFrame=videoAnimation.frame(activeSkin,skin,state,skinCatalog[activeSkin].base,!pose&&!reacting&&!data.reduced);
 const dockFrame=pose?anim.dockLayout(skin.dock,pose,elapsed,!!data.reduced):null;
 const key=videoFrame?videoFrame.key:JSON.stringify([activeSkin,pose,pose?dockFrame:[frame.source,frame.box,frame.draw,frame.image||sample.clip],sample.lift||0,sample.electric||0,!!sample.question]);
 if(key===lastPaintKey){reportRegions();return;}lastPaintKey=key;paintCount++;ctx.clearRect(0,0,192,208);
 if(videoFrame){const v=videoFrame.video,scale=Math.min(192/v.videoWidth,208/v.videoHeight),w=v.videoWidth*scale,h=v.videoHeight*scale;ctx.drawImage(v,(192-w)/2,208-h,w,h);}
 else if(pose){const p=dockFrame,[sx,sy]=p.source,[bx,by,br,bb]=p.box;ctx.save();if(p.rotate)ctx.setTransform(-1,0,0,-1,192,208);ctx.drawImage(skinImages[p.imageKey],sx+bx,sy+by,br-bx,bb-by,p.x+bx*p.scale,p.y+by*p.scale,(br-bx)*p.scale,(bb-by)*p.scale);ctx.restore();}
 else{const f=skin.clips[sample.clip].frames[sample.frame],[sx,sy,w,h]=f.source,[bx,by,br,bb]=f.box,[dx,dy,dw,dh]=f.draw,rx=dw/w,ry=dh/h;
  if(sample.electric){ctx.save();ctx.globalAlpha=sample.electric;ctx.strokeStyle='#c4efff';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<48;i++){const a=-Math.PI/2+i*Math.PI/24,k=i%2?.91:1.08,x=96+74*k*Math.cos(a),y=108+86*k*Math.sin(a);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();ctx.restore();}
  if(sample.question){ctx.font='700 30px system-ui';ctx.fillStyle='#edc64b';ctx.fillText('?',157,48);}
  ctx.save();ctx.translate(0,-(sample.lift||0));ctx.drawImage(skinImages[f.image||sample.clip],sx+bx,sy+by,br-bx,bb-by,dx+bx*rx,dy+by*ry,(br-bx)*rx,(bb-by)*ry);ctx.restore();}
  measureInk();readbackCount++;
  // Keep the quota badge adjacent to the visible character, not the canvas box.
  const scale=innerWidth/300,r=avatar.getBoundingClientRect();
  if(data.dock==='bottom')chip.style.top=Math.max(300,r.top/scale+ink.y-chip.offsetHeight-8)+'px';
  else if(data.dock==='top')chip.style.top=(r.top/scale+ink.y+ink.height+8)+'px';
  else chip.style.removeProperty('top');
  reportRegions();
}
function draw(now){if(now-lastDraw>=15){lastDraw=now;paint();}requestAnimationFrame(draw);}
requestAnimationFrame(draw);
window.inoriSmokeState=()=>({canvasReady:skinReady,skinError,skin:activeSkin,pendingSkin,animation:scene.dataset.animation,idlePhase:scene.dataset.idlePhase,completionRate:anim.COMPLETION_RATE,skinKeys:Object.keys(skinImages),state:scene.dataset.state,dock:scene.dataset.dock,classes:scene.className,avatarLeft:getComputedStyle(avatar).left,avatarTop:getComputedStyle(avatar).top,candidateKeys:Object.keys(candidates),panelVisible:!panel.hidden,quota:$('compact').textContent,panelWithinWindow:(()=>{const r=panel.getBoundingClientRect();return panel.hidden||(r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1);})()});

window.inoriRenderStats=()=>({paintCount,readbackCount});
