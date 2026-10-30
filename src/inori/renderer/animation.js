'use strict';
(function(root){
const BLINK=[1,2,3,4,3,2,1,0],COMPLETION_RATE=.6;
function sample(state,elapsed,idleMs=0,reduced=false){
 elapsed=Math.max(0,elapsed);idleMs=Math.max(0,idleMs);
 if(state==='completed'){const t=elapsed*COMPLETION_RATE;if(reduced||t>=1200)return{clip:'blink',frame:0};return{clip:'completed',frame:Math.min(47,Math.floor(t/25)),lift:t>=300&&t<=900?12*Math.sin(Math.PI*(t-300)/600):0};}
 if(state==='error')return{clip:'error',frame:reduced?11:Math.min(11,Math.floor(elapsed/90))};
 if(state==='interrupted')return{clip:'interrupted',frame:reduced?7:Math.min(7,Math.floor(elapsed/90)),electric:!reduced&&elapsed<450?1-elapsed/450:0};
 if(state==='unknown')return{clip:'unknown',frame:reduced?7:Math.min(7,Math.floor(elapsed/140)),question:true};
 if(state==='idle'){
  if(idleMs>=300000){const t=idleMs-300000;return{clip:'sleep',frame:reduced?10:t<1080?[4,5,6,9,10,11][Math.min(5,Math.floor(t/180))]:[9,10,11,10][Math.floor((t-1080)/900)%4],phase:'sleep'};}
  if(idleMs>=120000)return{clip:'sleep',frame:reduced?3:Math.min(3,Math.floor((idleMs-120000)/250)),phase:'doze'};
  if(!reduced&&idleMs>=60000&&idleMs<61800)return{clip:'stretch',frame:Math.min(11,Math.floor((idleMs-60000)/150)),phase:'stretch'};
  const cycle=idleMs%4424;return{clip:'blink',frame:reduced||cycle<4200?0:BLINK[Math.min(7,Math.floor((cycle-4200)/28))],phase:'awake'};
 }
 if(state==='working'||state==='waiting'){const cycle=elapsed%4420;return{clip:state,frame:reduced||cycle<4200?0:[1,2,1,3][Math.min(3,Math.floor((cycle-4200)/55))]};}
 return{clip:'unknown',frame:0,question:true};
}
function duration(action){return action==='peace'?1485:1200;}
function interaction(action,elapsed,reduced=false){if(elapsed>=duration(action))return null;if(reduced)return{clip:action,frame:0};if(action==='peace'){let t=elapsed;for(let i=0;i<16;i++){const ms=i===7?360:75;if(t<ms)return{clip:'peace',frame:i};t-=ms;}}return{clip:'wave',frame:Math.min(15,Math.floor(elapsed/75))};}
function dockLayout(dock,edge,elapsed=0,reduced=false){
 const key=edge==='top'&&dock.topDerivedFromBottom?'bottom':edge,sequence=dock.animations?.[key];
 const index=sequence?.frames?.length&&!reduced?Math.floor(Math.max(0,elapsed)/sequence.frameMs)%sequence.frames.length:0;
 const p=sequence?.frames?.[index]||dock.poses[key],scale=p.scale??dock.targetFaceWidth/(p.face[2]-p.face[0]),[bx,by,br,bb]=p.box;
 const x=edge==='left'?-bx*scale:edge==='right'?192-br*scale:96-(bx+br)/2*scale,y=(edge==='left'||edge==='right'?194:208)-bb*scale,rotate=edge==='top'&&!!dock.topDerivedFromBottom;
 const faceRect={x:x+p.face[0]*scale,y:y+p.face[1]*scale,width:(p.face[2]-p.face[0])*scale,height:(p.face[3]-p.face[1])*scale};
 if(rotate){faceRect.x=192-faceRect.x-faceRect.width;faceRect.y=208-faceRect.y-faceRect.height;}
 return{scale,x,y,source:p.source,box:p.box,face:p.face,imageKey:p.imageKey||'dock',rotate,faceRect,faceWidthTarget:p.faceWidthTarget??dock.targetFaceWidth};
}
function timedClip(manifest,clip,elapsed,reduced=false){
 const value=manifest.clips?.[clip];if(!value||!Number.isFinite(value.frameMs)||value.frameMs<=0||!value.frames?.length)return null;
 const count=value.frames.length,n=Math.floor(Math.max(0,elapsed)/value.frameMs);
 return {clip,frame:reduced?(value.reducedFrame??0):value.loop?n%count:Math.min(count-1,n)};
}
function sampleAsset(manifest,state,elapsed,idleMs=0,reduced=false){
 // A generated stretch must finish before the ordinary idle phase resumes.
 const stretchDuration=manifest.videos?.stretch?.durationMs;
 if(state==='idle'&&!reduced&&Number.isFinite(stretchDuration)&&idleMs>=60000&&idleMs<60000+stretchDuration){
  const clip=manifest.idlePhases?.stretch,timed=clip&&timedClip(manifest,clip,idleMs-60000,false);
  if(timed)return{...timed,phase:'stretch'};
 }
 const original=sample(state,elapsed,idleMs,reduced);
 if(state==='idle'&&original.phase!=='awake'){
  const phase=original.phase,phases=manifest.idlePhases||{};
  let clip=phases[phase],time=phase==='stretch'?idleMs-60000:phase==='doze'?idleMs-120000:idleMs-300000;
  let videoPhase=phase;
  if(phase==='sleep'&&phases.sleepEnter){
   const entry=manifest.clips[phases.sleepEnter],videoDuration=manifest.videos?.sleepEnter?.durationMs;
   const duration=Number.isFinite(videoDuration)&&videoDuration>0?videoDuration:entry.frames.length*entry.frameMs;
   if(!reduced&&time<duration){clip=phases.sleepEnter;videoPhase='sleepEnter';}else time=Math.max(0,time-duration);
  }
  const timed=clip&&timedClip(manifest,clip,time,reduced);return timed?{...timed,phase,videoPhase}:original;
 }
 const clip=manifest.stateMap?.[state],timed=clip&&timedClip(manifest,clip,elapsed,reduced);
 return timed?{...timed,...(state==='unknown'?{question:true}:{})}:original;
}
function videoLayout(entry,pose=null){
 const p=entry?.presentation,scale=Number.isFinite(p?.scale)&&p.scale>0?p.scale:1;
 const x=Number.isFinite(p?.x)?p.x:0,y=Number.isFinite(p?.y)?p.y:0;
 const rotate=pose==='top',matrix=rotate?[-scale,0,0,-scale,192-x,208-y]:[scale,0,0,scale,x,y];
 const [bx,by,bw,bh]=entry?.visibleBounds||[0,0,192,208];
 let left=x+bx*scale,top=y+by*scale,right=left+bw*scale,bottom=top+bh*scale;
 if(rotate){[left,right]=[192-right,192-left];[top,bottom]=[208-bottom,208-top];}
 left=Math.max(0,left);top=Math.max(0,top);right=Math.min(192,right);bottom=Math.min(208,bottom);
 return{matrix,bounds:{x:left,y:top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)}};
}
root.InoriAnimation={sample,interaction,duration,dockLayout,COMPLETION_RATE,timedClip,sampleAsset,videoLayout};
})(globalThis);
