// Runs the actual desktop entry and renderer against a hidden native window.
// Source instrumentation is in memory only; no production test IPC is exposed.
const {app,BrowserWindow,screen,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const mainPath=process.env.INORI_TEST_MAIN||path.join(root,'src/inori/main.cjs');
const out=process.env.INORI_TEST_OUT||path.join(root,'interaction-regression');
fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test');
let window,cursor={x:0,y:0};
class HiddenWindow extends BrowserWindow {constructor(options){super({...options,show:false});window=this;}}
const actualElectron=require('electron');
const screenProxy=new Proxy(screen,{get(target,key){if(key==='getCursorScreenPoint')return()=>cursor;const v=target[key];return typeof v==='function'?v.bind(target):v;}});
const moduleUnderTest=new Module(mainPath,module);moduleUnderTest.filename=mainPath;moduleUnderTest.paths=Module._nodeModulePaths(path.dirname(mainPath));
const nativeRequire=moduleUnderTest.require.bind(moduleUnderTest);
moduleUnderTest.require=name=>name==='electron'?{...actualElectron,BrowserWindow:HiddenWindow,screen:screenProxy}:nativeRequire(name);
const code=fs.readFileSync(mainPath,'utf8')+'\nmodule.exports={relocate,setDock,resizePet,save,menu,settings,snapshot,send,takeMessage,getDrag:()=>drag,getRegions:()=>regions,getWindow:()=>win,getSettingsPanel:()=>settingsPanel};';
moduleUnderTest._compile(code,mainPath);
const api=moduleUnderTest.exports;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
function record(name,pass,details){results.push({name,pass,details});}
async function js(code){return window.webContents.executeJavaScript(code);}
async function bodyRect(){return js(`(()=>{const avatar=document.getElementById('avatar'),r=avatar.getBoundingClientRect(),c=document.getElementById('sprite'),v=c.getContext('2d').getImageData(0,0,192,208).data;let x0=192,y0=208,x1=0,y1=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(v[(y*192+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}return{x:r.left+x0*r.width/192,y:r.top+y0*r.height/208,width:(x1-x0)*r.width/192,height:(y1-y0)*r.height/208};})()`);}



async function run(){
 const deadline=Date.now()+15000;while((!api.getSettingsPanel()||!window||window.webContents.isLoading())&&Date.now()<deadline)await wait(75);
 async function skinReady(id){for(let i=0;i<70;i++){const v=await js('window.inoriSmokeState()');if(v.canvasReady&&v.skin===id&&!v.pendingSkin)return v;if(v.skinError)throw Error(v.skinError);await wait(50);}throw Error('Outfit did not become ready: '+id);}
 if(process.argv.includes('--outfit-restart')){
  const v=await skinReady('battle');record('battle-selection-survives-restart',api.settings.skin==='battle'&&v.skin==='battle',{});
  fs.writeFileSync(path.join(out,'restart.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));app.exit(results.every(r=>r.pass)?0:1);return;
 }
 await skinReady('redwhite');
 const panel=await api.getSettingsPanel().open(),set=patch=>panel.webContents.executeJavaScript('window.pet.set('+JSON.stringify(patch)+')');
 const get=()=>panel.webContents.executeJavaScript('window.pet.get()');
 const initial=await get();record('both-built-in-outfits-listed',initial.skins.map(s=>s.id).join(',')==='redwhite,battle',{});
 record('real-selector-enabled',await panel.webContents.executeJavaScript("!document.getElementById('skin').disabled&&document.getElementById('skin').options.length===2"),{});
 await set({size:.8,reduced:true,dockEnabled:true,dock:'left'});await wait(100);
 const before={size:api.settings.size,reduced:api.settings.reduced,dock:api.settings.dock,quota:JSON.stringify(api.snapshot.quota),status:JSON.stringify(api.snapshot.status)};
 await panel.webContents.executeJavaScript("document.getElementById('skin').value='battle';document.getElementById('skin').dispatchEvent(new Event('change',{bubbles:true}));");await skinReady('battle');await wait(150);
 record('actual-selector-switches-rendered-outfit',api.settings.skin==='battle'&&(await get()).skin.id==='battle',{});
 record('switch-preserves-settings-and-state',api.settings.size===before.size&&api.settings.reduced===before.reduced&&api.settings.dock===before.dock&&JSON.stringify(api.snapshot.quota)===before.quota&&JSON.stringify(api.snapshot.status)===before.status,{});
 record('hit-regions-follow-new-outfit',api.getRegions()[0]?.skinId==='battle',{});
 record('unknown-outfit-rejected',await panel.webContents.executeJavaScript("window.pet.set({skin:'../arbitrary'}).then(()=>false,()=>true)"),{});
 await set({dock:null,size:1});await wait(100);
 const capture=async(file)=>{await js('paint();reportRegions()');const get=()=>Promise.race([window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),new Promise((_,reject)=>setTimeout(()=>reject(Error('capture timeout')),2500))]);await get();await wait(150);fs.writeFileSync(path.join(out,file),(await get()).toPNG());};
 await capture('battle-free.png');
 for(const edge of ['left','right','top','bottom']){await set({dock:edge});await wait(150);await js('paint();reportRegions()');const v=await js('window.inoriSmokeState()');record('battle-'+edge+'-renders',v.canvasReady&&v.skin==='battle'&&v.dock===edge&&!v.skinError,{});await capture('battle-'+edge+'.png');}
 await set({dock:null,skin:'redwhite'});await skinReady('redwhite');await capture('redwhite-free.png');
 record('switch-back-renders-original-outfit',(await js('window.inoriSmokeState()')).skin==='redwhite',{});
 await panel.webContents.executeJavaScript("Promise.all([window.pet.set({skin:'battle'}),window.pet.set({skin:'redwhite'}),window.pet.set({skin:'battle'}),window.pet.set({skin:'redwhite'})])");await skinReady('redwhite');await wait(150);
 record('rapid-selection-keeps-last-request',api.settings.skin==='redwhite'&&(await js('window.inoriSmokeState()')).skin==='redwhite',{});
 await set({skin:'battle'});await skinReady('battle');
 for(const state of ['idle','working','waiting','completed','error','interrupted','unknown']){
  api.snapshot.status={state,label:'模拟状态 · 服装检查',threads:[]};api.send();await wait(60);await js('paint();reportRegions()');
  const v=await js("(()=>{const a=document.getElementById('sprite').getContext('2d').getImageData(0,0,192,208).data;let pixels=0;for(let i=3;i<a.length;i+=4)if(a[i]>32)pixels++;return{...window.inoriSmokeState(),pixels};})()");
  record('battle-state-'+state,v.skin==='battle'&&v.pixels>1000&&!v.skinError,{pixels:v.pixels});
 }
 const panelCapture=()=>Promise.race([panel.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),new Promise((_,reject)=>setTimeout(()=>reject(Error('capture timeout')),2500))]);
 await panelCapture();await wait(150);fs.writeFileSync(path.join(out,'outfit-settings.png'),(await panelCapture()).toPNG());
 await wait(400);const saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));record('battle-choice-written-to-profile',saved.skin==='battle',{});
 const report={passed:results.every(r=>r.pass),mode:'isolated-real-settings-and-renderer; status-preview-only',results};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:results.length,failed:results.filter(r=>!r.pass)}));app.exit(report.passed?0:1);
}
app.whenReady().then(run).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2)});
setTimeout(()=>app.exit(3),30000);
