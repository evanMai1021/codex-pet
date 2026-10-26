'use strict';
const e=require('electron'),{app,screen,BrowserWindow,ipcMain}=e,fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
let cursor={x:0,y:0};const events=[],checks=[],trace=[];
app.on('browser-window-created',(_event,w)=>{
 let ready=false;w.once('ready-to-show',()=>{ready=true;events.push({id:w.id,title:w.getTitle(),method:'ready-to-show'});});
 for(const method of ['setResizable','setBounds','setSize','setPosition','setOpacity','showInactive','hide']){const native=w[method].bind(w);w[method]=(...args)=>{events.push({id:w.id,title:w.getTitle(),method,args,ready,visible:w.isVisible()});return native(...args);};}
});
const proxy=new Proxy(screen,{get(t,k){if(k==='getCursorScreenPoint')return()=>cursor;const v=t[k];return typeof v==='function'?v.bind(t):v;}});
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));const req=m.require.bind(m);m.require=n=>n==='electron'?{...e,screen:proxy}:req(n);
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();
 const panels=()=>({bubble:BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡')});
 const displays=screen.getAllDisplays().sort((a,b)=>b.scaleFactor-a.scaleFactor),first=displays[0];
 api.getSnapshot().status={state:'working',title:'模拟松手首帧',threads:[{}]};api.send();api.getPanel().apply({dock:null,size:1,bubbleEnabled:true});pet.setPosition(first.workArea.x+200,20);await wait(1200);
 const sameId=panels().bubble.id;events.length=0;
 for(let i=0;i<8;i++){const b=pet.getBounds();pet.setPosition(b.x+6,b.y);await wait(70);}
 checks.push({name:'same-monitor-no-window-recreation',pass:panels().bubble.id===sameId});
 for(const dest of [...displays.slice(1),first]){
  const old=panels(),ids={bubble:old.bubble.id},start=pet.getBounds(),target={x:dest.workArea.x+200,y:20};cursor={x:start.x+140,y:start.y+400};const grab={...cursor};ipcMain.emit('inori:press',{});events.length=0;
  for(let i=1;i<=20;i++){cursor={x:Math.round(grab.x+(target.x-start.x)*i/20),y:grab.y};ipcMain.emit('inori:drag',{});await wait(45);}
  checks.push({name:'drag-keeps-panels-hidden-'+dest.id,pass:Object.values(panels()).every(w=>!w||!w.isVisible())});
  ipcMain.emit('inori:release',{});
  for(let i=0;i<60;i++){await wait(25);const p=Object.values(panels());if(p.every(w=>w&&!w.isDestroyed()&&w.isVisible()&&w.getOpacity()>.99))break;}
  for(const [name,w] of Object.entries(panels())){
   const log=events.filter(v=>v.title===w.getTitle()),b=w.getBounds(),expected={width:300,height:328};
   checks.push({name:`${name}-fresh-window-at-destination-${dest.id}`,pass:w.id!==ids[name],beforeId:ids[name],afterId:w.id});
   checks.push({name:`${name}-first-show-after-native-first-frame-${dest.id}`,pass:log.some(v=>v.id===w.id&&v.method==='showInactive')&&log.filter(v=>v.method==='showInactive').every(v=>v.ready)});
   checks.push({name:`${name}-no-opacity-surface-toggle-${dest.id}`,pass:!log.some(v=>v.method==='setOpacity')});
   checks.push({name:`${name}-visible-at-target-size-${dest.id}`,pass:w.isVisible()&&w.getOpacity()>.99&&Math.abs(b.width-expected.width)<=8&&Math.abs(b.height-expected.height)<=8,bounds:b});
  }
  trace.push({destination:dest.id,events:[...events]});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks,trace},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);app.exit(2);});setTimeout(()=>app.exit(3),30000);