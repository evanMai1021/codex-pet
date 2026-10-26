'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{createRequire}=require('node:module');
test('actual quit handler hides windows immediately and exits when bridge finishes',async()=>{
 const file=path.resolve(__dirname,'../src/inori/main.cjs'),native=createRequire(file),app=new EventEmitter();
 Object.assign(app,{isPackaged:false,setPath(){},setName(){},requestSingleInstanceLock:()=>true,whenReady:()=>new Promise(()=>{})});
 let hidden=false,exited=false,writes=0;const bridge=new EventEmitter();
 bridge.stdin={write(){},end(){setTimeout(()=>bridge.emit('exit',0),20);}};
 const win={hide(){hidden=true;},isDestroyed:()=>false,getBounds:()=>({x:0,y:0})};
 app.exit=()=>{exited=true;};
 const timers=[];
 const context={require:id=>id==='electron'?{app,BrowserWindow:{getAllWindows:()=>[win]},ipcMain:{on(){}}}:id==='node:fs'?{...fs,mkdirSync(){},readFileSync(){throw Error('isolated');},writeFileSync(){writes++;}}:id==='./details-window.cjs'?{createDetailsWindow:()=>({update(){},close(){}})}:id==='./task-bubble.cjs'?{createTaskBubble:()=>({close(){}})}:native(id),
  process:{env:{INORI_DATA_DIR:path.dirname(file)},argv:[]},__dirname:path.dirname(file),console,Buffer,
  setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timers.push(t);return t;},clearTimeout, module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports={setWindow:w=>win=w,setBridge:b=>bridge=b};',context,{filename:file});
 context.module.exports.setWindow(win);context.module.exports.setBridge(bridge);
 try{
  app.emit('before-quit',{preventDefault(){}});
  assert.equal(hidden,true,'pet must disappear at quit request, before bridge cleanup');
  assert.ok(writes>=1,'settings and lifecycle evidence saved before exit');
  await new Promise(r=>setTimeout(r,80));assert.equal(exited,true,'bridge exit must finish app without fixed 3.5s delay');
 }finally{timers.forEach(clearTimeout);}
});
