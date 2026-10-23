'use strict';
const {BrowserWindow,screen,ipcMain}=require('electron'),path=require('node:path');
const {taskBubble,placeBubble,bubbleHeadline}=require('./bubble-model.cjs');
function createTaskBubble({hidden=false,onSettings=()=>{}}={}){
 let win,lastText='',lastBounds='',ready=false,phraseIndex=0,lastState='',lastArgs;
 ipcMain.on('bubble:cycle',event=>{if(win&&!win.isDestroyed()&&event.sender===win.webContents){phraseIndex++;if(lastArgs)update(...lastArgs);}});
 ipcMain.on('bubble:settings',event=>{if(win&&!win.isDestroyed()&&event.sender===win.webContents)onSettings();});
 function hide(){if(win&&!win.isDestroyed())win.hide();}
 function update(snapshot,anchor,enabled,options={}){
  lastArgs=[snapshot,anchor,enabled,options];
  const model=taskBubble(snapshot);
  if(model.state!==lastState){phraseIndex=0;lastState=model.state;}
  model.headline=bubbleHeadline(model,options,phraseIndex);
  if(!enabled||!model.visible){hide();return;}
  if(!win||win.isDestroyed()){
   ready=false;lastText='';lastBounds='';win=new BrowserWindow({width:276,height:136,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,show:false,skipTaskbar:true,alwaysOnTop:true,focusable:false,hasShadow:false,webPreferences:{preload:path.join(__dirname,'bubble-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.setIgnoreMouseEvents(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
   win.webContents.on('did-finish-load',()=>{ready=true;lastText='';});win.loadFile(path.join(__dirname,'renderer/bubble.html'));
  }
  const bounds=placeBubble(anchor,screen.getDisplayMatching(anchor).workArea,276,model.action?156:136),key=JSON.stringify(bounds);if(key!==lastBounds){lastBounds=key;win.setBounds(bounds);}
  if(ready){const text=JSON.stringify(model);if(text!==lastText){lastText=text;win.webContents.send('bubble:update',model);}if(!hidden&&!win.isVisible())win.showInactive();}
 }
 function close(){if(win&&!win.isDestroyed())win.destroy();win=null;ready=false;}
 return {update,hide,close};
}
module.exports={createTaskBubble};
