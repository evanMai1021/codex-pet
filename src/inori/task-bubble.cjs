'use strict';
const {BrowserWindow,screen,ipcMain}=require('electron'),path=require('node:path');
const {taskBubble,placeBubble,bubbleHeadline}=require('./bubble-model.cjs');
const PAGES=new Set(['task','quota','usage']),WIDTH=300,HEIGHT=328;
function createTaskBubble({hidden=false,onRefresh=()=>{},onConfirm=()=>{}}={}){
 let win,lastText='',lastBounds='',lastPlacement=null,ready=false,painted=false,allowed=false,phraseIndex=0,lastState='',lastArgs;
 let page='task',manual=false,dismissed='',selectedThreadId='';
 const statusKey=s=>[s?.status?.state,s?.status?.threadId,s?.status?.turnId].join(':');
 const trusted=event=>win&&!win.isDestroyed()&&event.sender===win.webContents;
 const rerender=()=>{if(lastArgs)update(...lastArgs);};
 ipcMain.on('bubble:cycle',event=>{if(trusted(event)&&allowed){phraseIndex++;rerender();}});
 ipcMain.on('bubble:page',(event,value)=>{if(trusted(event)&&PAGES.has(value)){page=value;manual=true;dismissed='';rerender();}});
 ipcMain.on('bubble:thread',(event,value)=>{if(trusted(event)&&(value===''||(lastArgs?.[0]?.threadUsage?.threads||[]).some(t=>t.threadId===value))){selectedThreadId=value;rerender();}});
 ipcMain.on('bubble:dismiss',event=>{if(trusted(event))dismiss();});
 ipcMain.on('bubble:refresh',event=>{if(trusted(event))onRefresh();});
 ipcMain.on('bubble:confirm',event=>{if(trusted(event))onConfirm(lastArgs?.[0]?.quota?.fingerprint);});
 function hide(){allowed=false;if(win&&!win.isDestroyed()&&win.isVisible())win.hide();}
 function dismiss(){manual=false;dismissed=statusKey(lastArgs?.[0]);hide();}
 function open(value='quota'){page=PAGES.has(value)?value:'quota';manual=true;dismissed='';}
 function toggle(value='quota'){if(manual&&page===value)dismiss();else open(value);}
 function reset(){manual=false;dismissed='';page='task';}
 function create(bounds,displayKey,scale){
  if(win&&!win.isDestroyed()){win.hide();win.destroy();}ready=false;painted=false;lastText='';
  const target=new BrowserWindow({...bounds,title:'楪祈 · 任务气泡',frame:false,thickFrame:false,transparent:true,backgroundColor:'#00000000',resizable:false,maximizable:false,minimizable:false,fullscreenable:false,show:false,skipTaskbar:true,alwaysOnTop:true,focusable:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'bubble-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,zoomFactor:scale}});
  win=target;lastBounds=JSON.stringify([displayKey,bounds]);lastPlacement={displayKey,width:bounds.width,height:bounds.height};
  target.webContents.setWindowOpenHandler(()=>({action:'deny'}));target.webContents.on('will-navigate',e=>e.preventDefault());
  target.on('close',event=>{event.preventDefault();dismiss();});
  target.once('ready-to-show',()=>{if(win!==target)return;painted=true;if(allowed)rerender();});
  target.webContents.on('did-finish-load',()=>{if(win!==target)return;ready=true;lastText='';if(allowed)rerender();});
  target.loadFile(path.join(__dirname,'renderer/bubble.html')).catch(()=>{if(win===target){ready=false;painted=false;}});
 }
 function update(snapshot,anchor,enabled,options={}){
  lastArgs=[snapshot,anchor,enabled,options];let model=taskBubble(snapshot);
  allowed=!!enabled&&(manual||(options.bubbleEnabled!==false&&model.visible&&dismissed!==statusKey(snapshot)));
  if(!allowed){hide();return;}
  if(!model.visible)model={visible:true,state:snapshot.status?.state||'unknown',label:snapshot.status?.state==='idle'?'暂无活动任务':'状态暂不可确认',title:snapshot.status?.state==='idle'?'暂无进行中的任务':'状态暂不可确认',progress:'',stage:'',action:'',count:0};
  if(model.state!==lastState){phraseIndex=0;lastState=model.state;}model.headline=model.state==='idle'?'陪你把事情做好呀～':bubbleHeadline(model,options,phraseIndex);
  model.page=page;model.quota=snapshot.quota||{};model.dailyUsage=snapshot.dailyUsage||{};model.threadUsage=snapshot.threadUsage||{};
  model.currentThreadId=snapshot.status?.threadId||'';model.selectedThreadId=selectedThreadId;
  const display=screen.getDisplayMatching(anchor),area=display.workArea,requested=[.8,1,1.2,1.4].includes(options.bubbleScale)?options.bubbleScale:1,scale=Math.min(requested,area.width/WIDTH,area.height/HEIGHT);
  const bounds=placeBubble(anchor,area,Math.round(WIDTH*scale),Math.round(HEIGHT*scale),options.obstacles||[]);
  if(!bounds){hide();return;}
  const displayKey=display.id+':'+display.scaleFactor,key=JSON.stringify([displayKey,bounds]);
  if(!win||win.isDestroyed()||lastPlacement?.displayKey!==displayKey)create(bounds,displayKey,scale);
  if(key!==lastBounds){
   const resize=lastPlacement.width!==bounds.width||lastPlacement.height!==bounds.height;lastBounds=key;
   if(resize){win.setResizable(true);win.setMinimumSize(0,0);win.setMaximumSize(0,0);win.setBounds(bounds);win.setResizable(false);}
   else{const b=win.getBounds();if(b.x!==bounds.x||b.y!==bounds.y)win.setBounds(bounds);}
   lastPlacement={displayKey,width:bounds.width,height:bounds.height};
  }
  if(ready&&Math.abs(win.webContents.getZoomFactor()-scale)>.0001)win.webContents.setZoomFactor(scale);
  if(ready){const text=JSON.stringify(model);if(text!==lastText){lastText=text;win.webContents.send('bubble:update',model);}if(painted&&!hidden&&!win.isVisible())win.showInactive();}
 }
 function close(){hide();if(win&&!win.isDestroyed())win.destroy();win=null;ready=false;}
 return {update,hide,close,open,toggle,dismiss,reset,getWindow:()=>win};
}
module.exports={createTaskBubble};
