'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out)throw Error('Use isolated report directory');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test');const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),electron=require('electron');
class HiddenWindow extends BrowserWindow{constructor(options){super({...options,show:false});}}
const under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));const native=under.require.bind(under);under.require=id=>id==='electron'?{...electron,BrowserWindow:HiddenWindow}:native(id);
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={snapshot,send,getWindow:()=>win,getPanel:()=>settingsPanel};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass)=>checks.push({name,pass});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(100);const win=api.getWindow(),js=s=>win.webContents.executeJavaScript(s),panel=await api.getPanel().open();
 const set=p=>panel.webContents.executeJavaScript('window.pet.set('+JSON.stringify(p)+')');
 const hash=()=>js("(()=>{const a=document.getElementById('sprite').getContext('2d').getImageData(0,0,192,208).data;let h=2166136261,p=0;for(let i=0;i<a.length;i++){h=Math.imul(h^a[i],16777619);if(i%4===3&&a[i]>32)p++;}return{hash:h>>>0,pixels:p};})()");
 for(const skin of ['redwhite','battle']){
  await set({skin,dock:null,reduced:false});for(let i=0;i<100;i++){if(await js(`window.inoriSmokeState().skin===${JSON.stringify(skin)}&&!window.inoriSmokeState().pendingSkin`))break;await wait(60);}
  api.snapshot.status={state:'idle',label:'模拟状态 · 剩余动画检查',threads:[]};api.send();await wait(400);
  for(const [age,expected] of [[60000,'continuousStretch'],[120000,'continuousDoze'],[300000,'continuousSleepEnter'],[301280,'continuousSleepLoop']]){
   await js(`idleSince=Date.now()-${age};data.lastInteraction=idleSince;paint()`);const actual=await js("document.getElementById('scene').dataset.animation"),pixels=await hash();record(skin+'-'+expected+'-actual-renderer',actual===expected&&pixels.pixels>500);
   await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(80);fs.writeFileSync(path.join(out,skin+'-'+expected+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  }
  for(const edge of ['left','right','top','bottom']){
   await set({dock:edge});await wait(300);await js('frameStart=Date.now();paint()');const first=await hash(),bounds=win.getBounds();await js('frameStart=Date.now()-900;paint()');const next=await hash();record(skin+'-'+edge+'-animates-without-moving-window',first.hash!==next.hash&&JSON.stringify(bounds)===JSON.stringify(win.getBounds()));
   await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(80);fs.writeFileSync(path.join(out,skin+'-dock-'+edge+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
   await set({reduced:true});await js('frameStart=Date.now();paint()');const still=await hash();await js('frameStart=Date.now()-900;paint()');record(skin+'-'+edge+'-reduced-stays-still',still.hash===(await hash()).hash);await set({reduced:false});
  }
 }
 const report={passed:checks.every(c=>c.pass),mode:'actual-hidden-renderer; simulated-idle-age-and-status',checks};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(report.passed?0:1);
}).catch(error=>{fs.writeFileSync(path.join(out,'error.txt'),String(error.stack));app.exit(2);});setTimeout(()=>app.exit(3),90000);
