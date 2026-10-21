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
const code=fs.readFileSync(mainPath,'utf8')+'\nmodule.exports={save,menu,settings,snapshot,send,takeMessage,getDrag:()=>drag,getRegions:()=>regions,getWindow:()=>win,getSettingsPanel:()=>settingsPanel};';
moduleUnderTest._compile(code,mainPath);
const api=moduleUnderTest.exports;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
function record(name,pass,details){results.push({name,pass,details});}
async function js(code){return window.webContents.executeJavaScript(code);}
async function bodyRect(){return js(`(()=>{const avatar=document.getElementById('avatar'),r=avatar.getBoundingClientRect(),c=document.getElementById('sprite'),v=c.getContext('2d').getImageData(0,0,192,208).data;let x0=192,y0=208,x1=0,y1=0;for(let y=0;y<208;y++)for(let x=0;x<192;x++)if(v[(y*192+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}return{x:r.left+x0*r.width/192,y:r.top+y0*r.height/208,width:(x1-x0)*r.width/192,height:(y1-y0)*r.height/208};})()`);}

async function run(){
 const deadline=Date.now()+15000;while((!api.getSettingsPanel()||!window||window.webContents.isLoading())&&Date.now()<deadline)await wait(100);
 for(let i=0;i<80&&!(await js('window.inoriSmokeState().canvasReady'));i++)await wait(75);
 if(process.argv.includes('--position-restart')){
  await wait(200);const b=window.getBounds(),q=await bodyRect(),a=screen.getPrimaryDisplay().workArea;
  record('saved-top-edge-position-restored',Math.abs(b.y+q.y-a.y)<=3&&api.settings.dockEnabled===false,{bounds:b,body:q});
  fs.writeFileSync(path.join(out,'restart.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));app.exit(results.every(r=>r.pass)?0:1);return;
 }
 api.settings.dockEnabled=false;api.settings.dock=null;api.snapshot.dock=null;api.send();await wait(150);
 for(const size of [.8,1,1.2]){
  const tray=api.menu();tray.items.find(i=>i.label==='大小').submenu.items[[.8,1,1.2].indexOf(size)].click();await wait(200);
  for(const edge of ['left','right','top','bottom']){
   const a=screen.getPrimaryDisplay().workArea;window.setPosition(a.x+Math.round(a.width/2-150*size),a.y+30);await wait(100);await js('paint()');await wait(60);
   const p=await bodyRect(),b=window.getBounds();cursor={x:Math.round(b.x+p.x+p.width/2),y:Math.round(b.y+p.y+p.height/2)};
   ipcMain.emit('inori:press',{});cursor={...cursor};
   if(edge==='left')cursor.x=a.x;if(edge==='right')cursor.x=a.x+a.width-1;if(edge==='top')cursor.y=a.y;if(edge==='bottom')cursor.y=a.y+a.height-1;
   ipcMain.emit('inori:drag',{});await wait(80);ipcMain.emit('inori:release',{});await wait(130);
   const q=await bodyRect(),w=window.getBounds();const chip=await js("(()=>{const r=document.getElementById('chip').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");
   const gap={left:w.x+q.x-a.x,right:a.x+a.width-w.x-q.x-q.width,top:w.y+q.y-a.y,bottom:a.y+a.height-w.y-Math.max(q.y+q.height,chip.y+chip.height)}[edge];
   const visible=w.x+q.x>=a.x-2&&w.y+q.y>=a.y-2&&w.x+q.x+q.width<=a.x+a.width+2&&w.y+chip.y+chip.height<=a.y+a.height+2;
   record(`free-${size}-${edge}-reaches-visible-edge`,Math.abs(gap)<=20&&visible&&api.settings.dock===null,{gap,visible,bounds:w,body:q,chip});
   await js("document.getElementById('chip').click();reportRegions()");await wait(160);
   const details=await js("(()=>{const r=document.getElementById('panel').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");const wb=window.getBounds();
   record(`free-${size}-${edge}-details-accessible`,wb.x+details.x>=a.x-2&&wb.y+details.y>=a.y-2&&wb.x+details.x+details.width<=a.x+a.width+2&&wb.y+details.y+details.height<=a.y+a.height+2,{bounds:wb,panel:details});
   await js("document.getElementById('close').click();reportRegions()");await wait(60);
  }
 }
 // Leave a true negative window coordinate saved at the top for a fresh-process check.
 const area=screen.getPrimaryDisplay().workArea,b=window.getBounds(),p=await bodyRect();
 window.setPosition(area.x+500,Math.round(area.y-p.y));api.save();await wait(450);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:results.every(r=>r.pass),results},null,2));console.log(JSON.stringify({passed:results.every(r=>r.pass),failed:results.filter(r=>!r.pass).map(r=>({name:r.name,gap:r.details.gap}))}));app.exit(results.every(r=>r.pass)?0:1);
}

app.whenReady().then(run).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2)});
setTimeout(()=>app.exit(3),30000);
