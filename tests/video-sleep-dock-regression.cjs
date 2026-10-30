'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data={})=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);pet.showInactive();
 const ready=async key=>{for(let i=0;i<100;i++){await wait(50);if(await js(`!!videoAnimation.video&&videoAnimation.video.readyState>=2&&videoAnimation.key.includes(${JSON.stringify(key+'-seedance')})`))return true;}return false;};
 api.getPanel().apply({skin:'redwhite',dock:null,size:1,reduced:false});api.getSnapshot().status={state:'idle',threads:[]};api.getSnapshot().lastInteraction=Date.now();api.send();
 if(!await ready('idle'))throw Error('Idle video unavailable');
 const eyeDistance=async(state,pose=null)=>{
  await js('videoAnimation.video.pause();videoAnimation.video.currentTime=0;true');await wait(160);
  const fallbackEyes={idle:[[76.082,93.948],[116.088,92.841]],'dock-left':[[21.896,102.641],[51.633,111.555]],'dock-right':[[140.273,128.021],[164.682,116.910]],'dock-bottom':[[84.733,180.918],[106.733,180.554]]}[state];
  const eyes=await js(`skin.videos[${JSON.stringify(state)}]?.eyeAnchors||null`)||fallbackEyes;
  return js(`(()=>{paint();const matrix=anim.videoLayout(skin.videos[${JSON.stringify(state)}],${JSON.stringify(pose)}).matrix,a=ctx.getImageData(0,0,192,208).data;const centres=${JSON.stringify(eyes)}.map(([sx,sy])=>{const x=matrix[0]*sx+matrix[4],y=matrix[3]*sy+matrix[5];let sum=0,xx=0,yy=0;for(let py=Math.max(0,Math.floor(y-4));py<=Math.min(207,Math.ceil(y+4));py++)for(let px=Math.max(0,Math.floor(x-4));px<=Math.min(191,Math.ceil(x+4));px++){const i=(py*192+px)*4,w=a[i+3]>160&&a[i]>a[i+2]+8?Math.max(0,a[i]-a[i+1]-30):0;sum+=w;xx+=px*w;yy+=py*w;}return sum?[xx/sum,yy/sum]:null;});return centres.every(Boolean)?Math.hypot(centres[0][0]-centres[1][0],centres[0][1]-centres[1][1]):null})()`);
 };
 const ordinaryEyes=await eyeDistance('idle');record('ordinary-face-measured',ordinaryEyes>35&&ordinaryEyes<45,{eyeDistance:ordinaryEyes});
 fs.writeFileSync(path.join(out,'ordinary.png'),(await pet.webContents.capturePage()).toPNG());
 await js('idleSince=Date.now()-300020;data.lastInteraction=idleSince;paint();true');record('entry-decoded',await ready('sleep-enter'));
 record('entry-plays-once',await js('!videoAnimation.video.loop'));
 await wait(1500);record('entry-not-cut-at-old-atlas-duration',await js("videoAnimation.key.includes('sleep-enter-seedance')"));
 fs.writeFileSync(path.join(out,'sleep-enter.png'),(await pet.webContents.capturePage()).toPNG());
 await wait(2700);record('entry-transitions-to-breathing',await ready('sleep-loop'));record('breathing-loops',await js('videoAnimation.video.loop'));
 fs.writeFileSync(path.join(out,'sleep-loop.png'),(await pet.webContents.capturePage()).toPNG());
 for(const dock of ['left','right','bottom','top']){
  api.getPanel().apply({dock});const key='dock-'+(dock==='top'?'bottom':dock);record('dock-decodes-'+dock,await ready(key));
  const pixels=await js(`(()=>{const a=ctx.getImageData(0,0,192,208).data;let opaque=0,green=0,minX=192,maxX=0,minY=208,maxY=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++){const i=(y*192+x)*4;if(a[i+3]>100){opaque++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(a[i+1]>a[i]+40&&a[i+1]>a[i+2]+40)green++;}}return{opaque,green,minX,maxX,minY,maxY}})()`);
  record('dock-transparent-and-clean-'+dock,pixels.opaque>1500&&pixels.opaque<23000&&pixels.green<30,{pixels});
  record('dock-edge-aligned-'+dock,dock==='left'?pixels.minX<=3:dock==='right'?pixels.maxX>=188:dock==='top'?pixels.minY<=3:pixels.maxY>=204);
  record('top-rotation-'+dock,await js(`(()=>{const m=new DOMMatrix(videoAnimation.video.style.transform);return ${dock==='top'?'m.a<0&&m.d<0':'m.a>0&&m.d>0'}})()`));
  record('single-native-video-'+dock,await js("document.querySelectorAll('video').length===1&&videoAnimation.video.videoWidth===576&&videoAnimation.video.loop"));
  const distance=await eyeDistance(key,dock),ratio=distance/ordinaryEyes;record('dock-face-matches-ordinary-'+dock,!!distance&&Math.abs(ratio-1)<.08,{eyeDistance:distance,ratio});
  fs.writeFileSync(path.join(out,'dock-'+dock+'.png'),(await pet.webContents.capturePage()).toPNG());
 }
 api.getPanel().apply({reduced:true});await wait(100);record('reduced-uses-atlas',await js('!videoAnimation.video'));
 api.getPanel().apply({reduced:false,skin:'battle'});await wait(700);record('battle-dock-uses-video',await ready('dock-bottom')&&await js("activeSkin==='battle'&&!!videoAnimation.video"));
 api.getPanel().apply({skin:'redwhite'});await ready('dock-bottom');await js('videoAnimation.video.dispatchEvent(new Event("error"));paint();true');
 record('broken-video-falls-back',await js("!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,checks,error:err.message},null,2));app.exit(2);});setTimeout(()=>app.exit(3),40000);
