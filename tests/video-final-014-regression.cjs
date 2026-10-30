'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data={})=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);pet.showInactive();
 const ready=async(skinId,key)=>{for(let i=0;i<100;i++){await wait(50);if(await js(`activeSkin===${JSON.stringify(skinId)}&&!!videoAnimation.video&&videoAnimation.video.readyState>=2&&videoAnimation.key.includes(${JSON.stringify(key+'-seedance')})`))return true;}return false;};
 const measure=async(key,pose=null)=>{
  await js('videoAnimation.video.pause();videoAnimation.video.currentTime=0;true');await wait(160);
  return js(`(()=>{paint();const entry=skin.videos[${JSON.stringify(key)}],fallback={'dock-left':[[21.896,102.641],[51.633,111.555]],'dock-bottom':[[84.733,180.918],[106.733,180.554]]},eyes=entry.eyeAnchors||fallback[${JSON.stringify(key)}],matrix=anim.videoLayout(entry,${JSON.stringify(pose)}).matrix,a=ctx.getImageData(0,0,192,208).data;const centres=eyes.map(([sx,sy])=>{const x=matrix[0]*sx+matrix[4],y=matrix[3]*sy+matrix[5];let sum=0,xx=0,yy=0;for(let py=Math.max(0,Math.floor(y-4));py<=Math.min(207,Math.ceil(y+4));py++)for(let px=Math.max(0,Math.floor(x-4));px<=Math.min(191,Math.ceil(x+4));px++){const i=(py*192+px)*4,w=a[i+3]>160&&a[i]>a[i+2]+8?Math.max(0,a[i]-a[i+1]-30):0;sum+=w;xx+=px*w;yy+=py*w;}return sum?[xx/sum,yy/sum]:null;});return centres.every(Boolean)?Math.hypot(centres[0][0]-centres[1][0],centres[0][1]-centres[1][1]):null})()`);
 };
 const capture=async(name)=>fs.writeFileSync(path.join(out,name+'.png'),(await pet.webContents.capturePage()).toPNG());
 api.getSnapshot().status={state:'idle',threads:[]};api.getSnapshot().lastInteraction=Date.now();api.send();api.getPanel().apply({size:1,dock:null,reduced:false});const original=pet.getBounds();
 for(const skinId of ['battle','redwhite']){
  api.getPanel().apply({skin:skinId,dock:null});record(skinId+'-idle-ready',await ready(skinId,'idle'));const reference=await measure('idle');record(skinId+'-reference-measured',reference>25&&reference<50,{eyeDistance:reference});await capture(skinId+'-idle');
  record(skinId+'-sixteen-video-states',await js('Object.keys(skin.videos).length===16'));
  for(const pose of ['left','right','bottom','top']){
   const key='dock-'+(pose==='top'?'bottom':pose);api.getPanel().apply({dock:pose});if(!await ready(skinId,key))throw Error(skinId+' '+key+' decoder failed');
   record(skinId+'-'+pose+'-single-video',await js("document.querySelectorAll('video').length===1&&videoAnimation.video.videoWidth===576&&videoAnimation.video.loop"));
   const distance=await measure(key,pose),ratio=distance/reference;record(skinId+'-'+pose+'-face-scale',!!distance&&Math.abs(ratio-1)<.09,{eyeDistance:distance,ratio});
   const pixels=await js("(()=>{const a=ctx.getImageData(0,0,192,208).data;let opaque=0,clear=0,green=0,minX=192,maxX=0,minY=208,maxY=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++){const i=(y*192+x)*4;if(a[i+3]<10)clear++;if(a[i+3]>100){opaque++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(a[i+1]>a[i]+40&&a[i+1]>a[i+2]+40)green++;}}return{opaque,clear,green,minX,maxX,minY,maxY}})()");
   record(skinId+'-'+pose+'-transparent',pixels.clear>3000&&pixels.opaque>1500&&pixels.green<30,{pixels});
   record(skinId+'-'+pose+'-touches-edge',pose==='left'?pixels.minX<=3:pose==='right'?pixels.maxX>=188:pose==='top'?pixels.minY<=3:pixels.maxY>=204);
   record(skinId+'-'+pose+'-top-rotation',await js(`(()=>{const m=new DOMMatrix(videoAnimation.video.style.transform);return ${pose==='top'?'m.a<0&&m.d<0':'m.a>0&&m.d>0'}})()`));await capture(skinId+'-'+pose);
   await js('videoAnimation.video.play();videoAnimation.video.currentTime=videoAnimation.video.duration-.15;true');let ending;
   for(let i=0;i<30;i++){await wait(100);ending=await js('({seeking:videoAnimation.video.seeking,time:videoAnimation.video.currentTime,paused:videoAnimation.video.paused})');if(!ending.seeking&&ending.time<1)break;}
   record(skinId+'-'+pose+'-loops',!ending.seeking&&!ending.paused&&ending.time<1,{ending});
  }
  api.getPanel().apply({dock:null,reduced:true});await wait(100);record(skinId+'-reduced-fallback',await js("!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));api.getPanel().apply({reduced:false});await ready(skinId,'idle');
 }
 api.getPanel().apply({skin:'battle',dock:null});await ready('battle','idle');await js('idleSince=Date.now()-121000;data.lastInteraction=idleSince;paint();true');record('accepted-doze-v2-ready',await ready('battle','doze'));record('accepted-doze-v2-file',await js("videoAnimation.video.currentSrc.endsWith('doze-seedance-mini-v2.webm')&&videoAnimation.video.loop"));await capture('battle-doze');
 await js('idleSince=Date.now();data.lastInteraction=idleSince;paint();true');await ready('battle','idle');for(const size of [.8,1,1.2]){api.getPanel().apply({size});await wait(120);record('configured-size-'+size,await js(`Math.abs(avatar.getBoundingClientRect().width-192*${size})<2`));}api.getPanel().apply({size:1});
 await js('videoAnimation.video.dispatchEvent(new Event("error"));paint();true');record('failed-video-restores-atlas',await js("!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));record('native-size-stable',Math.abs(pet.getBounds().width-original.width)<=4&&Math.abs(pet.getBounds().height-original.height)<=4);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,checks,error:e.stack},null,2));app.exit(2);});setTimeout(()=>app.exit(3),60000);
