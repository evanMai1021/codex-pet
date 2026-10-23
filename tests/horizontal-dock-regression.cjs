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
 const render=async()=>{await js('paint();reportRegions()');await wait(55);};
 if(process.argv.includes('--horizontal-position-restart')){
  await render();const b=window.getBounds(),p=await bodyRect(),a=screen.getPrimaryDisplay().workArea;
  record('restart-keeps-top-near-left',api.settings.dock==='top'&&Math.abs(b.x+p.x-a.x)<=2,{gap:b.x+p.x-a.x,dock:api.settings.dock});
  fs.writeFileSync(path.join(out,'restart.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));app.exit(results.every(r=>r.pass)?0:1);return;
 }
 api.settings.dockEnabled=true;api.snapshot.reduced=true;
 for(const size of [.8,1,1.2]){
  api.resizePet(size);await wait(130);
  for(const edge of ['top','bottom'])for(const end of ['left','right']){
   api.setDock(edge);await wait(100);await render();
   const a=screen.getPrimaryDisplay().workArea,edgeY=edge==='top'?a.y:a.y+a.height-window.getBounds().height;
   window.setPosition(end==='left'?a.x-900:a.x+a.width+900,edgeY);api.relocate(a);await render();
   let b=window.getBounds(),p=await bodyRect(),gap=end==='left'?b.x+p.x-a.x:a.x+a.width-b.x-p.x-p.width;
   record(`${size}-${edge}-${end}-bound`,Math.abs(gap)<=2&&b.y===edgeY,{gap,dock:api.settings.dock});
   window.setPosition(a.x+Math.round(a.width/2-150*size),edgeY);await render();b=window.getBounds();p=await bodyRect();cursor={x:Math.round(b.x+p.x+p.width/2),y:Math.round(b.y+p.y+p.height/2)};
   ipcMain.emit('inori:press',{});cursor={...cursor,x:end==='left'?a.x:a.x+a.width-1};ipcMain.emit('inori:drag',{});await render();ipcMain.emit('inori:release',{});await wait(100);await render();
   b=window.getBounds();p=await bodyRect();gap=end==='left'?b.x+p.x-a.x:a.x+a.width-b.x-p.x-p.width;
   record(`${size}-${edge}-${end}-horizontal-drag`,api.settings.dock===edge&&Math.abs(gap)<=2,{gap,dock:api.settings.dock});
   const stable=window.getBounds();await render();record(`${size}-${edge}-${end}-no-jitter`,JSON.stringify(window.getBounds())===JSON.stringify(stable),{});
   await js("document.getElementById('chip').click();reportRegions()");await wait(90);
   const panel=await js("(()=>{const r=document.getElementById('panel').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");b=window.getBounds();
   record(`${size}-${edge}-${end}-details-visible`,b.x+panel.x>=a.x-2&&b.y+panel.y>=a.y-2&&b.x+panel.x+panel.width<=a.x+a.width+2&&b.y+panel.y+panel.height<=a.y+a.height+2,{});
   await js("document.getElementById('close').click();reportRegions()");await wait(40);
   window.setPosition(a.x+Math.round(a.width/2-150*size),edgeY);await render();b=window.getBounds();p=await bodyRect();cursor={x:Math.round(b.x+p.x+p.width/2),y:Math.round(b.y+p.y+p.height/2)};
   ipcMain.emit('inori:press',{});cursor={...cursor,y:Math.round(a.y+a.height/2)};ipcMain.emit('inori:drag',{});await render();ipcMain.emit('inori:release',{});await wait(100);await render();
   record(`${size}-${edge}-${end}-perpendicular-detach`,api.settings.dock===null,{dock:api.settings.dock});
  }
 }
 api.setDock('top');await wait(100);await render();const a=screen.getPrimaryDisplay().workArea;window.setPosition(a.x-900,a.y);api.relocate(a);await render();api.save();await wait(350);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));
 console.log(JSON.stringify({passed:results.every(r=>r.pass),checks:results.length,failed:results.filter(r=>!r.pass)}));app.exit(results.every(r=>r.pass)?0:1);
}
app.whenReady().then(run).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2)});
setTimeout(()=>app.exit(3),30000);
