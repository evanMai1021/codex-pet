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
function dockLayout(dock,edge){
 const key=edge==='top'&&dock.topDerivedFromBottom?'bottom':edge,p=dock.poses[key],scale=p.scale??dock.targetFaceWidth/(p.face[2]-p.face[0]),[bx,by,br,bb]=p.box;
 const x=edge==='left'?-bx*scale:edge==='right'?192-br*scale:96-(bx+br)/2*scale,y=(edge==='left'||edge==='right'?194:208)-bb*scale,rotate=edge==='top'&&!!dock.topDerivedFromBottom;
 const faceRect={x:x+p.face[0]*scale,y:y+p.face[1]*scale,width:(p.face[2]-p.face[0])*scale,height:(p.face[3]-p.face[1])*scale};
 if(rotate){faceRect.x=192-faceRect.x-faceRect.width;faceRect.y=208-faceRect.y-faceRect.height;}
 return{scale,x,y,source:p.source,box:p.box,face:p.face,imageKey:p.imageKey||'dock',rotate,faceRect,faceWidthTarget:p.faceWidthTarget??dock.targetFaceWidth};
}
root.InoriAnimation={sample,interaction,duration,dockLayout,COMPLETION_RATE};
})(globalThis);
