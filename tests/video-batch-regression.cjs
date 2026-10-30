'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data={})=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);pet.showInactive();
 const ready=async key=>{for(let i=0;i<120;i++){await wait(50);if(await js(`!!videoAnimation.video&&videoAnimation.video.readyState>=2&&videoAnimation.key.includes(${JSON.stringify(key+'-seedance')})`))return true;}return false;};
 const status=async(state,turn='one')=>{api.getSnapshot().status={state,turnId:turn,label:'模拟批量视频验证',threads:[]};api.getSnapshot().lastInteraction=Date.now();api.send();await wait(80);};
 api.getPanel().apply({skin:'redwhite',dock:null,size:1,reduced:false});
 const original=pet.getBounds();
 for(const [state,loop] of [['waiting',true],['completed',false],['error',false],['interrupted',false],['unknown',true]]){
  await status(state);if(!await ready(state))throw Error(state+' decoder not ready');
  record('state-file-and-loop-'+state,await js(`videoAnimation.video.currentSrc.endsWith('${state}-seedance-mini-v1.webm')&&videoAnimation.video.loop===${loop}`));
  const p=await js(`(()=>{const a=ctx.getImageData(0,0,192,208).data;let transparent=0,opaque=0,green=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<10)transparent++;if(a[i+3]>240)opaque++;if(a[i+3]>100&&a[i+1]>a[i]+60&&a[i+1]>a[i+2]+60)green++;}return{transparent,opaque,green}})()`);
  record('transparent-clean-'+state,p.transparent>2000&&p.opaque>10000&&p.green<50,{pixels:p});
  record('one-native-video-layer-'+state,await js("document.querySelectorAll('video').length===1&&videoAnimation.video.parentElement===avatar&&videoAnimation.video.videoWidth===576"));
  fs.writeFileSync(path.join(out,state+'.png'),(await pet.webContents.capturePage()).toPNG());
  await js('videoAnimation.video.currentTime=Math.max(0,videoAnimation.video.duration-.12);true');
  let ending;for(let i=0;i<25;i++){await wait(100);ending=await js('({time:videoAnimation.video.currentTime,duration:videoAnimation.video.duration,seeking:videoAnimation.video.seeking,ended:videoAnimation.video.ended,paused:videoAnimation.video.paused,ready:videoAnimation.video.readyState})');if(!ending.seeking&&(loop?ending.time<1:ending.ended))break;}
  record('correct-end-behavior-'+state,loop?!ending.paused&&ending.time<1:ending.ended&&ending.paused,{ending});
  if(!loop){
   const old=await js('window.batchOldVideo=videoAnimation.video;videoAnimation.key');api.send();await wait(100);
   record('snapshot-does-not-replay-'+state,await js('videoAnimation.video===window.batchOldVideo&&videoAnimation.video.ended'));
   await status(state,'two');await ready(state);
   record('new-turn-replays-'+state,await js('videoAnimation.video!==window.batchOldVideo&&videoAnimation.video.currentTime<1&&!videoAnimation.video.ended'),{oldKey:old});
  }
 }
 await status('idle');await ready('idle');
 for(const action of ['wave','peace']){
  await js(`(()=>{overlayUntil=0;const savedRandom=Math.random;Math.random=()=>${action==='wave'?'.1':'.9'};interaction();Math.random=savedRandom;paint();return true})()`);
  if(!await ready(action))throw Error(action+' decoder not ready');
  record('reaction-uses-full-video-duration-'+action,await js(`activeClick==='${action}'&&overlayUntil-clickStartedAt>4000&&!videoAnimation.video.loop`));
  await wait(1800);record('reaction-not-cut-at-legacy-duration-'+action,await js(`Date.now()<overlayUntil&&!!videoAnimation.video&&videoAnimation.key.includes('${action}-seedance')`));
  fs.writeFileSync(path.join(out,action+'.png'),(await pet.webContents.capturePage()).toPNG());
  await js('overlayUntil=0;paint();true');await ready('idle');
 }
 await js('idleSince=Date.now()-60020;data.lastInteraction=idleSince;paint();true');if(!await ready('stretch'))throw Error('Stretch not ready');await wait(1900);
 record('stretch-finishes-full-length',await js("scene.dataset.idlePhase==='stretch'&&!!videoAnimation.video&&videoAnimation.key.includes('stretch-seedance')"));
 fs.writeFileSync(path.join(out,'stretch.png'),(await pet.webContents.capturePage()).toPNG());
 await js('idleSince=Date.now()-65000;data.lastInteraction=idleSince;paint();true');record('stretch-returns-to-idle',await ready('idle'));
 await js('idleSince=Date.now()-121000;data.lastInteraction=idleSince;paint();true');record('doze-uses-video',await ready('doze')&&await js('videoAnimation.video.loop'));
 fs.writeFileSync(path.join(out,'doze.png'),(await pet.webContents.capturePage()).toPNG());
 await js('idleSince=Date.now()-301000;data.lastInteraction=idleSince;paint();true');record('sleep-entry-uses-video',await ready('sleep-enter'));
 await status('working');await ready('working');
 api.getPanel().apply({reduced:true});await wait(100);record('reduced-motion-stops-videos',await js("!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));api.getPanel().apply({reduced:false});await ready('working');
 await status('idle');
 for(const dock of ['left','right','top','bottom']){api.getPanel().apply({dock});const key='dock-'+(dock==='top'?'bottom':dock);record('dock-remains-correct-'+dock,await ready(key)&&await js(`scene.dataset.animation==='dock-${dock}'`));}
 api.getPanel().apply({dock:null});await status('completed','dock-completion');await ready('completed');api.getPanel().apply({dock:'right'});await js('frameStart=Date.now()-2500;paint();true');
 record('docked-completion-not-cut-at-two-seconds',await js("scene.classList.contains('peek')&&!!videoAnimation.video&&videoAnimation.key.includes('completed-seedance')"));
 api.getPanel().apply({dock:null,skin:'battle'});await wait(650);record('battle-completed-video-retained',await js("activeSkin==='battle'&&!!videoAnimation.video&&videoAnimation.key.includes('completed-seedance')"));
 api.getPanel().apply({skin:'redwhite'});await status('waiting');await ready('waiting');await js('videoAnimation.video.dispatchEvent(new Event("error"));paint();true');
 record('bad-video-uses-own-atlas',await js("!videoAnimation.video&&videoAnimation.failed.size===1&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));
 record('native-window-size-stable',Math.abs(pet.getBounds().width-original.width)<=8&&Math.abs(pet.getBounds().height-original.height)<=8);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,checks,error:err.message},null,2));app.exit(2);});setTimeout(()=>app.exit(3),45000);
