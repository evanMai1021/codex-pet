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
 for(let i=0;i<80&&!(await js('window.inoriSmokeState().canvasReady'));i++)await wait(75);
 if(process.argv.includes('--side-position-restart')){
  await js('paint();reportRegions()');await wait(160);const b=window.getBounds(),p=await bodyRect(),a=screen.getPrimaryDisplay().workArea;
  record('restart-keeps-side-and-top-position',api.settings.dock==='right'&&Math.abs(b.y+p.y-a.y)<=2,{gap:b.y+p.y-a.y,dock:api.settings.dock});
  fs.writeFileSync(path.join(out,'restart.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));app.exit(results.every(r=>r.pass)?0:1);return;
 }
 api.settings.dockEnabled=true;api.snapshot.reduced=true;
 const render=async()=>{await js('paint();reportRegions()');await wait(60);};
 for(const size of [.8,1,1.2]){
  api.resizePet(size);await wait(150);
  for(const side of ['left','right']){
   api.setDock(side);await wait(120);await render();
   const a=screen.getPrimaryDisplay().workArea;const edgeX=side==='left'?a.x:a.x+a.width-window.getBounds().width;
   window.setPosition(edgeX,a.y-900);api.relocate(a);await render();
   let b=window.getBounds(),p=await bodyRect();
   record(`${size}-${side}-top-bound`,Math.abs(b.y+p.y-a.y)<=2&&b.x===edgeX,{gap:b.y+p.y-a.y,dock:api.settings.dock,bounds:b});
   api.setDock(side);window.setPosition(edgeX,a.y+100);await render();
   b=window.getBounds();p=await bodyRect();cursor={x:Math.round(b.x+p.x+p.width/2),y:Math.round(b.y+p.y+p.height/2)};
   ipcMain.emit('inori:press',{});cursor={...cursor,y:a.y};ipcMain.emit('inori:drag',{});await render();ipcMain.emit('inori:release',{});await wait(120);await render();
   b=window.getBounds();p=await bodyRect();
   record(`${size}-${side}-vertical-drag-to-top`,api.settings.dock===side&&Math.abs(b.y+p.y-a.y)<=2,{gap:b.y+p.y-a.y,dock:api.settings.dock,bounds:b});
   const stable=window.getBounds();await render();record(`${size}-${side}-no-animation-position-jitter`,JSON.stringify(window.getBounds())===JSON.stringify(stable),{});
   await js("document.getElementById('chip').click();reportRegions()");await wait(100);
   const panel=await js("(()=>{const r=document.getElementById('panel').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");b=window.getBounds();
   record(`${size}-${side}-top-details-visible`,b.x+panel.x>=a.x-2&&b.y+panel.y>=a.y-2&&b.x+panel.x+panel.width<=a.x+a.width+2&&b.y+panel.y+panel.height<=a.y+a.height+2,{});
   await js("document.getElementById('close').click();reportRegions()");await wait(60);
   window.setPosition(edgeX,a.y+900);api.relocate(a);await render();
   const chip=await js("(()=>{const r=document.getElementById('chip').getBoundingClientRect();return{bottom:r.bottom};})()");b=window.getBounds();p=await bodyRect();
   record(`${size}-${side}-bottom-visible`,b.y+p.y>=a.y-2&&Math.abs(a.y+a.height-b.y-chip.bottom)<=2&&api.settings.dock===side,{});
   // Intentionally drag off the side: this must still detach instead of latching forever.
   window.setPosition(edgeX,a.y+30);await render();b=window.getBounds();p=await bodyRect();cursor={x:Math.round(b.x+p.x+p.width/2),y:Math.round(b.y+p.y+p.height/2)};
   ipcMain.emit('inori:press',{});cursor={...cursor,x:Math.round(a.x+a.width/2),y:Math.round(a.y+a.height/2)};ipcMain.emit('inori:drag',{});await render();ipcMain.emit('inori:release',{});await wait(100);await render();
   record(`${size}-${side}-horizontal-detach-still-works`,api.settings.dock===null,{dock:api.settings.dock});
  }
 }
 api.setDock('right');await wait(100);await render();const area=screen.getPrimaryDisplay().workArea;window.setPosition(area.x+area.width-window.getBounds().width,area.y-900);api.relocate(area);await render();api.save();await wait(350);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));
 console.log(JSON.stringify({passed:results.every(r=>r.pass),checks:results.length,failed:results.filter(r=>!r.pass)}));app.exit(results.every(r=>r.pass)?0:1);
}
app.whenReady().then(run).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2)});
setTimeout(()=>app.exit(3),30000);
