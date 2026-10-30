'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data={})=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);pet.showInactive();
 const ready=async(key,skin='battle')=>{for(let i=0;i<120;i++){await wait(50);if(await js(`activeSkin===${JSON.stringify(skin)}&&!!videoAnimation.video&&videoAnimation.video.readyState>=2&&videoAnimation.key.includes(${JSON.stringify(key+'-seedance')})`))return true;}return false;};
 const status=async(state,turn='one')=>{api.getSnapshot().status={state,turnId:turn,threads:[]};api.getSnapshot().lastInteraction=Date.now();api.send();await wait(80);};
 const capture=async key=>{fs.writeFileSync(path.join(out,key+'.png'),(await pet.webContents.capturePage()).toPNG());};
 const verify=async(key,loop)=>{
  record('decoder-'+key,await ready(key));
  record('correct-battle-file-and-loop-'+key,await js(`videoAnimation.video.currentSrc.endsWith('/battle/videos/${key}-seedance-mini-v1.webm')&&videoAnimation.video.loop===${loop}`));
  record('single-native-video-'+key,await js("document.querySelectorAll('video').length===1&&videoAnimation.video.parentElement===avatar&&videoAnimation.video.videoWidth===576"));
  const pixels=await js("(()=>{const a=ctx.getImageData(0,0,192,208).data;let opaque=0,clear=0,green=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>240)opaque++;if(a[i+3]<10)clear++;if(a[i+3]>100&&a[i+1]>a[i]+40&&a[i+1]>a[i+2]+40)green++;}return{opaque,clear,green}})()");
  record('transparent-clean-'+key,pixels.clear>2500&&pixels.opaque>6500&&pixels.green<30,{pixels});await capture(key);
 };
 const checkEnd=async(key,loop)=>{
  await js('videoAnimation.video.currentTime=videoAnimation.video.duration-.15;true');let ending;
  for(let i=0;i<40;i++){await wait(100);ending=await js('({time:videoAnimation.video.currentTime,seeking:videoAnimation.video.seeking,paused:videoAnimation.video.paused,ended:videoAnimation.video.ended})');if(!ending.seeking&&(loop?ending.time<1:ending.ended))break;}
  record('correct-end-'+key,loop?!ending.paused&&!ending.seeking&&ending.time<1:ending.ended&&ending.paused,{ending});
 };
 api.getPanel().apply({skin:'battle',dock:null,size:1,reduced:false});const original=pet.getBounds();
 for(const [state,loop] of [['working',true],['waiting',true],['completed',false],['error',false],['interrupted',false],['unknown',true]]){
  await status(state);await verify(state,loop);await checkEnd(state,loop);
  if(!loop){await js('window.batchOldVideo=videoAnimation.video;true');api.send();await wait(100);record('snapshot-keeps-ended-'+state,await js('videoAnimation.video===window.batchOldVideo&&videoAnimation.video.ended'));await status(state,'two');await ready(state);record('new-turn-replays-'+state,await js('videoAnimation.video!==window.batchOldVideo&&!videoAnimation.video.ended&&videoAnimation.video.currentTime<1'));}
 }
 await status('idle');await ready('idle');
 for(const action of ['wave','peace']){
  await js(`(()=>{overlayUntil=0;const random=Math.random;Math.random=()=>${action==='wave'?'.1':'.9'};interaction();Math.random=random;paint();return true})()`);await verify(action,false);
  await wait(1600);record('reaction-not-cut-'+action,await js(`Date.now()<overlayUntil&&videoAnimation.key.includes('${action}-seedance')`));
  await js('overlayUntil=0;paint();true');await ready('idle');
 }
 await js('idleSince=Date.now()-60020;data.lastInteraction=idleSince;paint();true');await verify('stretch',false);await wait(1900);record('stretch-not-cut-at-atlas-length',await js("scene.dataset.idlePhase==='stretch'&&videoAnimation.key.includes('stretch-seedance')"));
 await js('idleSince=Date.now()-60000-skin.videos.stretch.durationMs-100;data.lastInteraction=idleSince;paint();true');record('stretch-resumes-idle',await ready('idle'));
 await js('idleSince=Date.now()-121000;data.lastInteraction=idleSince;paint();true');record('doze-uses-current-video',await ready('doze'));
 await js('idleSince=Date.now()-300020;data.lastInteraction=idleSince;paint();true');await verify('sleep-enter',false);await wait(1500);record('entry-not-cut-at-atlas-length',await js("videoAnimation.key.includes('sleep-enter-seedance')"));
 await js('idleSince=Date.now()-300000-skin.videos.sleepEnter.durationMs-100;data.lastInteraction=idleSince;paint();true');await verify('sleep-loop',true);await checkEnd('sleep-loop',true);
 await status('idle');await ready('idle');for(const dock of ['left','right','top','bottom']){api.getPanel().apply({dock});record('dock-uses-current-video-'+dock,await ready('dock-'+(dock==='top'?'bottom':dock))&&await js(`scene.dataset.animation==='dock-${dock}'`));}
 api.getPanel().apply({dock:null});await status('working');await ready('working');
 api.getPanel().apply({reduced:true});await wait(100);record('reduced-retains-atlas',await js("!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));api.getPanel().apply({reduced:false});record('motion-restores-video',await ready('working'));
 for(const size of [.8,1,1.2]){api.getPanel().apply({size});await wait(120);record('configured-pet-size-'+size,await js(`Math.abs(avatar.getBoundingClientRect().width-192*${size})<2`));}api.getPanel().apply({size:1});
 api.getPanel().apply({skin:'redwhite'});record('redwhite-working-retained',await ready('working','redwhite'));api.getPanel().apply({skin:'battle'});record('battle-working-restored',await ready('working'));
 await js('videoAnimation.video.dispatchEvent(new Event("error"));paint();true');record('decoder-failure-uses-own-atlas',await js("activeSkin==='battle'&&!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));
 await status('idle');record('one-failure-keeps-other-videos',await ready('idle'));record('native-window-size-stable',Math.abs(pet.getBounds().width-original.width)<=2&&Math.abs(pet.getBounds().height-original.height)<=2);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,checks,error:e.stack},null,2));app.exit(2);});setTimeout(()=>app.exit(3),65000);
