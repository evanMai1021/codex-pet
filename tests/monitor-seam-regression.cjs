'use strict';
const e=require('electron'),{app,screen,ipcMain,BrowserWindow}=e,fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');let cursor={x:0,y:0};
const proxy=new Proxy(screen,{get(t,k){if(k==='getCursorScreenPoint')return()=>cursor;const v=t[k];return typeof v==='function'?v.bind(t):v;}});
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));const req=m.require.bind(m);m.require=n=>n==='electron'?{...e,screen:proxy}:req(n);
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,relocate};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],trace=[],overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();
 api.getSnapshot().status={state:'working',title:'模拟屏幕接缝停留',threads:[{}]};api.send();api.getPanel().apply({dockEnabled:false,dock:null,bubbleEnabled:true,size:1});await wait(900);
 const displays=screen.getAllDisplays().sort((a,b)=>a.bounds.x-b.bounds.x);if(displays.length<2)throw Error('Two real displays required');
 const seam=displays[1].bounds.x;
 for(const dx of [-4,0,4]){
  const a=displays[0].workArea;pet.setPosition(a.x+200,a.y+20);await wait(100);const p=pet.getBounds();cursor={x:p.x+150,y:p.y+400};ipcMain.emit('inori:press',{});
  cursor={x:seam+dx,y:p.y+400};ipcMain.emit('inori:drag',{});await wait(150);
  if(dx===0){pet.setResizable(true);pet.setSize(600,1120);pet.setResizable(false);await wait(150);}
  const drawn=await pet.webContents.executeJavaScript('({avatarWidth:avatar.getBoundingClientRect().width,chipHeight:chip.getBoundingClientRect().height})');
  checks.push({name:'render-size-is-capped-during-seam-drag-'+dx,pass:drawn.avatarWidth<=198&&drawn.chipHeight<=32,drawn,injectedNativeEnlargement:dx===0});
  let windows=BrowserWindow.getAllWindows().filter(w=>/任务气泡/.test(w.getTitle()));
  checks.push({name:'all-panels-hidden-before-seam-release-'+dx,pass:windows.every(w=>!w.isVisible()),visible:windows.filter(w=>w.isVisible()).map(w=>w.getTitle())});
  ipcMain.emit('inori:release',{});await wait(450);
  for(let i=0;i<30;i++){windows=BrowserWindow.getAllWindows().filter(w=>/任务气泡/.test(w.getTitle()));if(windows.length===1&&windows.every(w=>w.isVisible()&&w.getOpacity()>=.99))break;await wait(25);}
  const samples=[];let toggles=0;const count=()=>toggles++;
  for(const w of windows){w.on('show',count);w.on('hide',count);}
  for(let i=0;i<60;i++){samples.push(pet.getBounds());await wait(50);}
  for(const w of windows){w.off('show',count);w.off('hide',count);}
  checks.push({name:'stationary-seam-panels-do-not-flash-'+dx,pass:toggles===0,toggles,observedMs:3000});
  checks.push({name:'stationary-seam-panels-are-restored-'+dx,pass:windows.every(w=>w.isVisible()&&w.getOpacity()>=.99)});
  const b=samples.at(-1);
  const painted=await pet.webContents.executeJavaScript(`(()=>{const a=avatar.getBoundingClientRect(),c=chip.getBoundingClientRect();return[{x:a.x+ink.x*a.width/192,y:a.y+ink.y*a.height/208,width:ink.width*a.width/192,height:ink.height*a.height/208},{x:c.x,y:c.y,width:c.width,height:c.height}]})()`);
  const visible=painted.map(r=>({...r,x:r.x+b.x,y:r.y+b.y}));
  const owner=displays.find(d=>visible.every(r=>r.x>=d.workArea.x-2&&r.y>=d.workArea.y-2&&r.x+r.width<=d.workArea.x+d.workArea.width+2&&r.y+r.height<=d.workArea.y+d.workArea.height+2));
  checks.push({name:'painted-pet-and-badge-belong-to-one-monitor-'+dx,pass:!!owner,bounds:b,visible});
  checks.push({name:'seam-size-remains-bounded-'+dx,pass:samples.every(r=>Math.abs(r.width-300)<=8&&Math.abs(r.height-560)<=8),range:[Math.min(...samples.map(r=>r.width)),Math.max(...samples.map(r=>r.width))]});
  trace.push({dx,samples});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks,trace},null,2));if(checks.every(c=>c.pass))app.quit();else app.exit(1);
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);app.exit(2);});setTimeout(()=>app.exit(3),20000);
