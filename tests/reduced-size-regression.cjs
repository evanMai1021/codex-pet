'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getPanel:()=>settingsPanel,getWindow:()=>win,getSnapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,details)=>checks.push({name,pass,details});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(70);
 const panel=api.getPanel(),pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);
 const ready=async(skinId,reduced,dock=null,state='working')=>{const key=dock?'dock-'+(dock==='top'?'bottom':dock):state;for(let i=0;i<100;i++){await js('paint();reportRegions()');if(await js(`activeSkin===${JSON.stringify(skinId)}&&!!videoAnimation.video&&videoAnimation.video.readyState>=2&&videoAnimation.key.startsWith(activeSkin+':'+skin.videos[${JSON.stringify(key)}].file)&&videoAnimation.video.paused===${reduced}`))return;await wait(40);}throw Error('Expected video decoder/playback not ready: '+skinId+'/'+key+'/'+reduced);};
 const stats=()=>js(`({ink:{...ink},video:!!videoAnimation.video,paused:videoAnimation.video?.paused,time:videoAnimation.video?.currentTime,transform:videoAnimation.video?.style.transform,opacity:$('sprite').style.opacity})`);
 for(const skin of ['redwhite','battle']){
  panel.apply({skin,dock:null,reduced:true,quotaBadgeVisible:false});api.getSnapshot().status={state:'idle',threads:[]};api.getSnapshot().lastInteraction=Date.now();api.send();await ready(skin,true,null,'idle');
  const first=await stats();await wait(120);const next=await stats();record(skin+'-reduced-first-load-static',first.paused&&next.paused&&Math.abs(next.time-first.time)<.005);
 }
 for(const skin of ['redwhite','battle'])for(const dock of [null,'left','right','top','bottom'])for(const size of [.8,1,1.2]){
  panel.apply({skin,dockEnabled:true,dock,size,reduced:false,quotaBadgeVisible:false,bubbleEnabled:false});api.getSnapshot().status={state:'working',threads:[]};api.send();await ready(skin,false,dock);await wait(60);
  await js('window.motionVideo=videoAnimation.video;paint()');const before=await stats(),bounds=pet.getBounds();
  panel.apply({reduced:true});await wait(90);await js('paint()');const after=await stats();await wait(90);await js('paint()');const later=await stats();
  const name=[skin,dock??'free',size].join('-');
  record(name+'-same-video-and-scale',after.video&&after.paused&&after.transform===before.transform&&await js('motionVideo===videoAnimation.video')&&Math.abs(after.ink.width-before.ink.width)<=8&&Math.abs(after.ink.height-before.ink.height)<=8,{before,after});
  record(name+'-static-frame',after.video&&Math.abs((later.time??-1)-(after.time??-2))<.005,{after,later});
  record(name+'-native-size-preserved',pet.getBounds().width===bounds.width&&pet.getBounds().height===bounds.height);
  panel.apply({reduced:false});await ready(skin,false,dock);record(name+'-motion-resumes',await js('!!videoAnimation.video&&!videoAnimation.video.paused'));
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});setTimeout(()=>app.exit(3),50000);
