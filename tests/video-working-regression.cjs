'use strict';
// Real decoder and renderer, real video; status is synthetic, bridge disabled.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data={})=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);pet.showInactive();
 const status=state=>{api.getSnapshot().status={state,label:'模拟视频检查',threads:[]};api.getSnapshot().lastInteraction=Date.now();api.send();};
 const ready=async key=>{for(let i=0;i<100;i++){await wait(50);if(await js(`!!videoAnimation.video&&videoAnimation.video.readyState>=2&&videoAnimation.key.includes(${JSON.stringify(key)})`))return true;}return false;};
 api.getPanel().apply({skin:'redwhite',dock:null,reduced:false,size:1});status('working');
 if(!await ready('working-seedance'))throw Error('Working video failed to decode');
 record('working-uses-generated-video',await js("videoAnimation.video.currentSrc.endsWith('working-seedance-mini-v1.webm')"));
 record('native-higher-resolution-video-layer',await js("videoAnimation.video.videoWidth===576&&videoAnimation.video.videoHeight===624&&videoAnimation.video.parentElement===avatar&&getComputedStyle(document.getElementById('sprite')).opacity==='0'"));
 record('muted-looping-single-decoder',await js("videoAnimation.video.muted&&videoAnimation.video.loop&&document.querySelectorAll('video').length===1"));
 const before=await js('videoAnimation.video.currentTime');await wait(400);record('working-video-advances',await js('videoAnimation.video.currentTime')>before);
 const pixels=await js(`(()=>{const a=ctx.getImageData(0,0,192,208).data;let transparent=0,opaque=0,green=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<10)transparent++;if(a[i+3]>240)opaque++;if(a[i+3]>100&&a[i+1]>a[i]+60&&a[i+1]>a[i+2]+60)green++;}return{transparent,opaque,green}})()`);
 record('actual-renderer-transparent',pixels.transparent>2000&&pixels.opaque>10000,{pixels});record('no-green-spill',pixels.green<50,{green:pixels.green});
 await js('window.videoLoops=0;window.previousVideoTime=videoAnimation.video.currentTime;videoAnimation.video.addEventListener("timeupdate",()=>{if(videoAnimation.video.currentTime<window.previousVideoTime-.5)window.videoLoops++;window.previousVideoTime=videoAnimation.video.currentTime;});true');await wait(4100);
 record('working-loops-without-stall',await js('window.videoLoops>=1&&!videoAnimation.video.paused'));
 fs.writeFileSync(path.join(out,'actual-working.png'),(await pet.webContents.capturePage()).toPNG());
 const bounds=pet.getBounds();status('idle');record('idle-video-is-retained',await ready('idle-seedance'));status('working');record('switch-back-to-working-video',await ready('working-seedance'));
 record('status-switch-keeps-pet-size',Math.abs(pet.getBounds().width-bounds.width)<=2&&Math.abs(pet.getBounds().height-bounds.height)<=2);
 for(const size of [.8,1,1.2]){api.getPanel().apply({size});await wait(100);record('configured-size-'+size,await js(`Math.abs(avatar.getBoundingClientRect().width-192*${size})<2`));}
 api.getPanel().apply({size:1,reduced:true});await wait(100);record('reduced-motion-restores-atlas',await js("!videoAnimation.video&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'"));
 api.getPanel().apply({reduced:false});record('motion-reenabled-restores-video',await ready('working-seedance'));
 for(const dock of ['left','right','top','bottom']){api.getPanel().apply({dock});await wait(150);record('dock-keeps-own-video-'+dock,await ready('dock-'+(dock==='top'?'bottom':dock)+'-seedance')&&await js(`scene.dataset.animation==='dock-${dock}'`));}
 api.getPanel().apply({dock:null});await ready('working-seedance');const reaction=await js('interaction();paint();activeClick');record('click-reaction-uses-own-video',await ready(reaction+'-seedance'));await js('overlayUntil=0;paint();true');record('after-reaction-working-resumes',await ready('working-seedance'));
 for(const state of ['waiting','completed','error','interrupted','unknown']){status(state);await wait(120);record('state-uses-own-generated-video-'+state,await ready(state+'-seedance'));}
 status('working');api.getPanel().apply({skin:'battle'});await wait(650);record('battle-uses-own-working-video',await js("activeSkin==='battle'&&!!videoAnimation.video&&videoAnimation.key.includes('working-seedance')"));api.getPanel().apply({skin:'redwhite'});await ready('working-seedance');
 await js('videoAnimation.video.dispatchEvent(new Event("error"));paint();true');record('decoder-error-falls-back-to-working-atlas',await js("!videoAnimation.video&&videoAnimation.failed.size===1&&getComputedStyle(document.getElementById('sprite')).opacity!=='0'&&document.querySelectorAll('video').length===0"));
 status('idle');record('working-failure-does-not-disable-idle',await ready('idle-seedance'));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,checks,error:err.message},null,2));app.exit(2);});setTimeout(()=>app.exit(3),30000);
