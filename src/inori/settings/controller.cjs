'use strict';
const {BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
function createSettingsPanel(api){
 let panel;
 function get(){const raw=api.get();return {settings:{size:raw.size,dock:raw.dock,dockEnabled:raw.dockEnabled,reduced:raw.reduced,visible:raw.visible,skin:'inori'},status:{state:raw.status.state,label:raw.status.label},skin:{id:'inori',name:'楪祈（原桌宠）',license:'本机个人素材'},skins:[{id:'inori',name:'楪祈（原桌宠）'}]};}
 function publish(){if(panel&&!panel.isDestroyed())panel.webContents.send('pet:update',get());}
 async function open(){
  if(panel&&!panel.isDestroyed()){panel.show();panel.focus();publish();return panel;}
  panel=new BrowserWindow({width:950,height:760,minWidth:680,minHeight:550,title:'楪祈桌宠 · 设置',show:!api.hidden,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));panel.webContents.on('will-navigate',e=>e.preventDefault());
  await panel.loadFile(path.join(__dirname,'settings.html'));return panel;
 }
 function trusted(event){if(!panel||panel.isDestroyed()||event.sender!==panel.webContents)throw Error('仅楪祈设置窗口可调用');}
 ipcMain.handle('pet:get',event=>{trusted(event);return get();});
 ipcMain.handle('pet:set',(event,patch)=>{trusted(event);if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('设置无效');
  const allowed=['size','dock','dockEnabled','reduced','visible','skin'];if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('不支持的设置');
  if('size'in patch&&![.8,1,1.2].includes(patch.size))throw Error('大小使用原桌宠的小、标准、大三个档位');
  if('dock'in patch&&![null,'left','right','top','bottom'].includes(patch.dock))throw Error('停靠方向无效');
  for(const k of ['reduced','visible','dockEnabled'])if(k in patch&&typeof patch[k]!=='boolean')throw Error('开关值无效');
  const dockEnabled='dockEnabled'in patch?patch.dockEnabled:get().settings.dockEnabled;
  if(patch.dock&&!dockEnabled)throw Error('请先打开允许趴边开关');
  if('skin'in patch&&patch.skin!=='inori')throw Error('当前控制原楪祈桌宠');
  api.apply(patch);publish();return get();
 });
 ipcMain.handle('pet:import',event=>{trusted(event);throw Error('当前仅接入原楪祈桌宠，不导入其他角色');});
 ipcMain.handle('pet:settings',event=>{trusted(event);return open().then(()=>true);});
 return {open,publish,get};
}
module.exports={createSettingsPanel};
