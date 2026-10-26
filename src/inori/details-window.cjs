'use strict';
const {BrowserWindow,ipcMain,screen}=require('electron'),path=require('node:path');
const {placeBubble}=require('./bubble-model.cjs');
function createDetailsWindow(){
 let win,requested=false,latest,scale=1,loaded=false,painted=false,anchor,petVisible=true,lastPlacement=null;
 function conceal(){if(win&&!win.isDestroyed()&&win.isVisible())win.hide();}
 function create(bounds,displayKey,effective){
  conceal();if(win&&!win.isDestroyed())win.destroy();loaded=false;painted=false;
  const target=new BrowserWindow({...bounds,title:'楪祈 · 额度详情',frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,zoomFactor:effective}});
  win=target;lastPlacement={key:JSON.stringify([displayKey,bounds]),displayKey,bounds};
  target.webContents.setWindowOpenHandler(()=>({action:'deny'}));target.webContents.on('will-navigate',e=>e.preventDefault());
  target.on('close',event=>{event.preventDefault();hide();});
  target.once('ready-to-show',()=>{if(win!==target)return;painted=true;position();});
  target.webContents.on('did-finish-load',()=>{if(win!==target)return;loaded=true;target.webContents.send('inori:snapshot',latest);position();});
  target.loadFile(path.join(__dirname,'renderer/details.html'),{query:{details:'1'}}).catch(()=>{if(win===target){loaded=false;painted=false;}});
 }
 function position(){
  if(!requested||!anchor||!petVisible){conceal();return null;}
  const display=screen.getDisplayMatching(anchor),area=display.workArea,effective=Math.min(scale,area.width/320,area.height/520),displayKey=display.id+':'+display.scaleFactor;
  const bounds=placeBubble(anchor,area,Math.round(320*effective),Math.round(520*effective));
  if(!bounds){conceal();return null;}
  // A transparent surface belongs to the monitor on which it was created.
  // Never expose a recycled backing surface after moving it to another DPI.
  if(!win||win.isDestroyed()||lastPlacement?.displayKey!==displayKey){create(bounds,displayKey,effective);return bounds;}
  const key=JSON.stringify([displayKey,bounds]);
  if(lastPlacement.key!==key){
   const current=win.getBounds(),resize=lastPlacement.bounds.width!==bounds.width||lastPlacement.bounds.height!==bounds.height;
   if(resize){win.setPosition(bounds.x,bounds.y);win.setResizable(true);win.setMinimumSize(0,0);win.setMaximumSize(0,0);win.setSize(bounds.width,bounds.height);win.setResizable(false);}
   else if(current.x!==bounds.x||current.y!==bounds.y)win.setPosition(bounds.x,bounds.y);
   lastPlacement={key,displayKey,bounds};
  }
  if(loaded&&Math.abs(win.webContents.getZoomFactor()-effective)>.0001)win.webContents.setZoomFactor(effective);
  if(loaded&&painted&&!win.isVisible())win.showInactive();
  return bounds;
 }
 function follow(value,visible=true){anchor=value;petVisible=visible;return position();}
 function update(snapshot,value=1){latest=snapshot;scale=[.8,1,1.2,1.4,1.6].includes(value)?value:1;if(win&&!win.isDestroyed()){position();if(loaded)win.webContents.send('inori:snapshot',latest);}}
 function show(snapshot,value,petBounds){requested=true;anchor=petBounds;latest=snapshot;scale=[.8,1,1.2,1.4,1.6].includes(value)?value:1;position();}
 function hide(){requested=false;conceal();}
 function toggle(snapshot,value,petBounds){if(requested)hide();else show(snapshot,value,petBounds);}
 ipcMain.on('inori:details-close',event=>{if(win&&!win.isDestroyed()&&event.sender===win.webContents)hide();});
 function close(){requested=false;conceal();if(win&&!win.isDestroyed())win.destroy();win=null;}
 return {show,hide,toggle,update,follow,close,isVisible:()=>requested,getWindow:()=>win};
}
module.exports={createDetailsWindow};
