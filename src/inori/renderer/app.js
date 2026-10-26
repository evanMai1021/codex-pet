'use strict';
const $=id=>document.getElementById(id),scene=$('scene'),avatar=$('avatar'),chip=$('chip');
const ctx=$('sprite').getContext('2d');
ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
let lastPaintKey='',lastRegionKey='',paintCount=0,readbackCount=0,lastQuotaKey='';
// Bounds are identical whenever the same source frame is drawn again.
const inkCache=new Map();
const bubbleEnvelopeCache=new Map();
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
  const decoded=new Map();
  skinCache.set(id,Promise.all(files.map(([key,file])=>{
   if(!decoded.has(file))decoded.set(file,new Promise((resolve,reject)=>{
    const im=new Image();im.onload=async()=>{try{await im.decode();resolve(im);}catch{reject(Error('服装资源未解码：'+file));}};im.onerror=()=>reject(Error('服装资源未加载：'+file));im.src=entry.base+file;
   }));
   return decoded.get(file).then(im=>{images[key]=im;});
  })).then(()=>({manifest,images})));
 }
 skinCache.get(id).then(bundle=>{
  if(token!==loadToken)return;
  skin=bundle.manifest;skinImages=bundle.images;activeSkin=id;pendingSkin=null;skinReady=true;skinError=null;frameStart=Date.now();overlayUntil=0;avatar.title='';paint();layout();
 }).catch(error=>{if(token!==loadToken)return;pendingSkin=null;skinCache.delete(id);skinError=error.message;avatar.title=skinError;});
}
let data={status:{state:'unknown',threads:[]},quota:{health:'connecting',windows:[]},lastInteraction:Date.now(),dock:null},idleSince=Date.now(),lastState='unknown',overlayUntil=0,frameStart=Date.now(),petHover=false,press=null,clickTimer,lastRelease=0;
function visibleQuota(){return ['ok','stale','preview'].includes(data.quota.health);}
function formatTime(seconds){return seconds?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(seconds*1000)):'未知';}
function renderQuota(){
 const key=JSON.stringify(data.quota);if(key===lastQuotaKey)return;lastQuotaKey=key;
 const q=data.quota,windows=visibleQuota()?q.windows:[];
 $('compact').textContent=windows.length?windows.map(w=>`${w.label} ${Math.round(w.remaining)}%`).join(' · '):({unverified:'额度 · 核对账户',connecting:'额度连接中',unavailable:'额度未连接','account-mismatch':'账户已变化'}[q.health]??'额度未知');
}
function apply(value){
 data=value;loadSkin(value.skin??'redwhite');const state=value.status.state;const nextKey=state+':'+(value.status.turnId??'');if(nextKey!==stateKey){stateKey=nextKey;frameStart=Date.now();}
 if(state!=='idle'||lastState!=='idle')idleSince=Date.now();
 lastState=state;scene.dataset.state=state;scene.dataset.dock=value.dock??'free';scene.classList.toggle('reduced',!!value.reduced);
 renderQuota();layout();paint();
}
function layout(){const scale=Math.min(data.petSize??1,innerWidth/300,innerHeight/560);scene.style.transform=`scale(${scale})`;requestAnimationFrame(reportRegions);}
let ink={x:48,y:20,width:96,height:180};
function layoutEnvelope(pose){
 const key=activeSkin+':'+pose;
 if(!bubbleEnvelopeCache.has(key))bubbleEnvelopeCache.set(key,window.InoriBubbleGeometry.visibleEnvelope(skin,pose,anim));
 return bubbleEnvelopeCache.get(key);
}
function positionBadge(){
 if(!skinReady)return;
 const edge=data.dock,pose=edge&&!scene.classList.contains('peek')?edge:null,envelope=layoutEnvelope(pose);
 const originY=edge==='top'?0:edge==='bottom'?352:316;
 const target=edge==='bottom'?originY+envelope.y-chip.offsetHeight-8:originY+envelope.y+envelope.height+8;
 chip.style.top=Math.max(0,Math.min(target,560-chip.offsetHeight-4))+'px';
}
function reportRegions(){if(!skinReady)return;positionBadge();const scale=innerWidth/300,r=avatar.getBoundingClientRect(),unit=r.width/192/scale;
 const pose=data.dock||null,envelope=layoutEnvelope(pose),currentEnvelope=layoutEnvelope(scene.classList.contains('peek')?null:pose);
 // Include both tucked and peek poses at their target positions, not CSS transition frames.
 const free=pose?layoutEnvelope(null):envelope;
 const ax=pose==='left'?0:pose==='right'?108:54,ay=pose==='top'?0:pose==='bottom'?352:316;
 const x=Math.min(envelope.x,free.x),y=Math.min(envelope.y,free.y),right=Math.max(envelope.x+envelope.width,free.x+free.width),bottom=Math.max(envelope.y+envelope.height,free.y+free.height);
 const body={kind:'body',skinId:activeSkin,bubbleLayout:[activeSkin,data.dock].join(':'),x:r.left/scale+ink.x*unit,y:r.top/scale+ink.y*unit,width:ink.width*unit,height:ink.height*unit,
  bubbleBounds:{x:r.left/scale+currentEnvelope.x*unit,y:r.top/scale+currentEnvelope.y*unit,width:currentEnvelope.width*unit,height:currentEnvelope.height*unit},
  detailsBounds:{x:(ax+x)*unit,y:(ay+y)*unit,width:(right-x)*unit,height:(bottom-y)*unit}};
 // Report the complete badge, even if outside the viewport; clipping must not hide it from placement.
 const regions=[body,...[...(data.dock&&scene.classList.contains('peek')?[avatar]:[]),chip].map(el=>{const r=el.getBoundingClientRect();return{kind:el===chip?'chip':'hit',x:r.left/scale,y:r.top/scale,width:r.width/scale,height:r.height/scale};})];const signature=JSON.stringify(regions);if(signature!==lastRegionKey){lastRegionKey=signature;window.inori.regions(regions);}
}
function measureInk(){const a=ctx.getImageData(0,0,192,208).data;let x0=192,y0=208,x1=0,y1=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(a[(y*192+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}if(x1>x0)ink={x:x0,y:y0,width:x1-x0,height:y1-y0};}
function interaction(){if(Date.now()<overlayUntil)return;window.inori.interact();idleSince=Date.now();activeClick=Math.random()<.5?'wave':'peace';clickStartedAt=Date.now();const videoDuration=skin.videos?.[activeClick]?.durationMs;overlayUntil=clickStartedAt+(Number.isFinite(videoDuration)?videoDuration:anim.duration(activeClick));}
avatar.addEventListener('pointerdown',e=>{if(e.button!==0)return;press={x:e.screenX,y:e.screenY,dragged:false};avatar.setPointerCapture(e.pointerId);window.inori.press();});
avatar.addEventListener('pointermove',e=>{if(!press)return;if(Math.hypot(e.screenX-press.x,e.screenY-press.y)>6)press.dragged=true;if(press.dragged){clearTimeout(clickTimer);layout();scene.classList.add('dragging');window.inori.drag();}});
avatar.addEventListener('pointerup',()=>{if(!press)return;const dragged=press.dragged;press=null;scene.classList.remove('dragging');window.inori.release();if(dragged){lastRelease=0;return;}clearTimeout(clickTimer);const now=Date.now();if(lastRelease&&now-lastRelease<=300){lastRelease=0;window.inori.usageToggle();}else{lastRelease=now;clickTimer=setTimeout(()=>{lastRelease=0;interaction();},300);}});
avatar.addEventListener('dblclick',()=>{clearTimeout(clickTimer);});
avatar.addEventListener('pointercancel',()=>{press=null;scene.classList.remove('dragging');window.inori.release();});
avatar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();interaction();}});
chip.addEventListener('click',()=>window.inori.usageToggle());
document.addEventListener('contextmenu',e=>{e.preventDefault();window.inori.menu();});
scene.addEventListener('pointermove',e=>{if(press)return;const onPet=!!e.target.closest('#avatar,#chip');if(onPet!==petHover){petHover=onPet;window.inori.hover(onPet);}});
scene.addEventListener('pointerleave',()=>{petHover=false;window.inori.hover(false);});
window.addEventListener('resize',layout);window.inori.onSnapshot(apply);window.inori.get().then(apply);
function paint(){if(!skinReady)return;
 const now=Date.now(),state=data.status.state,idleMs=Math.max(0,now-Math.max(idleSince,data.lastInteraction??0)),elapsed=Math.max(0,now-frameStart),reacting=now<overlayUntil;
 const completedPeekMs=Math.max(2000,skin.videos?.completed?.durationMs||0);
 const peeking=!!data.dock&&(reacting||(!!data.peek&&['waiting','error'].includes(state))||(state==='completed'&&elapsed<completedPeekMs));
 scene.classList.toggle('peek',peeking);const pose=data.dock&&!peeking?data.dock:null;scene.classList.toggle('candidate-pose',!!pose);
 positionBadge();
 let sample=reacting?anim.interaction(activeClick,now-clickStartedAt,!!data.reduced):null;sample=sample||anim.sampleAsset(skin,state,elapsed,idleMs,!!data.reduced);
 scene.dataset.animation=pose?'dock-'+pose:sample.clip;scene.dataset.idlePhase=state==='idle'?(sample.phase||'awake'):'awake';
 const frame=skin.clips[sample.clip].frames[sample.frame];
 const phase=state==='idle'&&sample.phase&&sample.phase!=='awake'?sample.phase:null;
 const videoKey=reacting?activeClick:phase||state;
 const videoEpoch=reacting?clickStartedAt:phase?idleSince:frameStart;
 const videoFrame=videoAnimation.frame(activeSkin,skin,videoKey,skinCatalog[activeSkin].base,!pose&&!data.reduced,videoEpoch);
 // Display the decoded video directly so high-DPI/large pets do not upscale a 192px bitmap.
 if(videoFrame&&videoFrame.video.parentElement!==avatar){videoFrame.video.className='continuous-video';avatar.insertBefore(videoFrame.video,$('state-dot'));}
 $('sprite').style.opacity=videoFrame?'0':'';
 const dockFrame=pose?anim.dockLayout(skin.dock,pose,elapsed,!!data.reduced):null;
 const key=videoFrame?videoFrame.key:JSON.stringify([activeSkin,pose,pose?dockFrame:[frame.source,frame.box,frame.draw,frame.image||sample.clip],sample.lift||0,sample.electric||0,!!sample.question]);
 if(key===lastPaintKey){reportRegions();return;}lastPaintKey=key;paintCount++;ctx.clearRect(0,0,192,208);
 if(videoFrame){const v=videoFrame.video,scale=Math.min(192/v.videoWidth,208/v.videoHeight),w=v.videoWidth*scale,h=v.videoHeight*scale;ctx.drawImage(v,(192-w)/2,208-h,w,h);}
 else if(pose){const p=dockFrame,[sx,sy]=p.source,[bx,by,br,bb]=p.box;ctx.save();if(p.rotate)ctx.setTransform(-1,0,0,-1,192,208);ctx.drawImage(skinImages[p.imageKey],sx+bx,sy+by,br-bx,bb-by,p.x+bx*p.scale,p.y+by*p.scale,(br-bx)*p.scale,(bb-by)*p.scale);ctx.restore();}
 else{const f=skin.clips[sample.clip].frames[sample.frame],[sx,sy,w,h]=f.source,[bx,by,br,bb]=f.box,[dx,dy,dw,dh]=f.draw,rx=dw/w,ry=dh/h;
  if(sample.electric){ctx.save();ctx.globalAlpha=sample.electric;ctx.strokeStyle='#c4efff';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<48;i++){const a=-Math.PI/2+i*Math.PI/24,k=i%2?.91:1.08,x=96+74*k*Math.cos(a),y=108+86*k*Math.sin(a);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();ctx.restore();}
  if(sample.question){ctx.font='700 30px system-ui';ctx.fillStyle='#edc64b';ctx.fillText('?',157,48);}
  ctx.save();ctx.translate(0,-(sample.lift||0));ctx.drawImage(skinImages[f.image||sample.clip],sx+bx,sy+by,br-bx,bb-by,dx+bx*rx,dy+by*ry,(br-bx)*rx,(bb-by)*ry);ctx.restore();}
  if(!videoFrame&&inkCache.has(key))ink=inkCache.get(key);
  else{
   measureInk();readbackCount++;
   if(!videoFrame){if(inkCache.size>=256)inkCache.delete(inkCache.keys().next().value);inkCache.set(key,ink);}
  }
  reportRegions();
}
function draw(){paint();requestAnimationFrame(draw);}
requestAnimationFrame(draw);
window.inoriSmokeState=()=>({canvasReady:skinReady,skinError,skin:activeSkin,pendingSkin,animation:scene.dataset.animation,idlePhase:scene.dataset.idlePhase,completionRate:anim.COMPLETION_RATE,skinKeys:Object.keys(skinImages),state:scene.dataset.state,dock:scene.dataset.dock,classes:scene.className,avatarLeft:getComputedStyle(avatar).left,avatarTop:getComputedStyle(avatar).top,candidateKeys:Object.keys(candidates),panelVisible:false,quota:$('compact').textContent,panelWithinWindow:true});

window.inoriRenderStats=()=>({paintCount,readbackCount});
