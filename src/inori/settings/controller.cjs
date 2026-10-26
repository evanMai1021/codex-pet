'use strict';
const {BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
const {SKINS,normalizeSkin}=require('../skins.cjs');
const {bubblePhraseGroups,normalizeBubbleTone}=require('../bubble-model.cjs');
function createSettingsPanel(api){
 let panel;
 function get(){const raw=api.get(),skin=SKINS.find(s=>s.id===normalizeSkin(raw.skin));return {settings:{bubbleScale:raw.bubbleScale??1,bubbleTone:normalizeBubbleTone(raw.bubbleTone),bubbleCustomLine:raw.bubbleCustomLine||'',bubbleEnabled:raw.bubbleEnabled!==false,followCodex:raw.followCodex===true,size:raw.size,dock:raw.dock,dockEnabled:raw.dockEnabled,reduced:raw.reduced,visible:raw.visible,skin:skin.id},status:{state:raw.status.state,label:raw.status.label},phrases:bubblePhraseGroups(raw),skin,skins:SKINS};}
 function apply(patch){api.apply(require('./schema.cjs').validatePatch(patch,get().settings));publish();return get();}
 function publish(){if(panel&&!panel.isDestroyed())panel.webContents.send('pet:update',get());}
 async function open(){
  if(panel&&!panel.isDestroyed()){panel.show();panel.focus();publish();return panel;}
  panel=new BrowserWindow({width:950,height:760,minWidth:680,minHeight:550,title:'楪祈桌宠 · 设置',show:!api.hidden,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));panel.webContents.on('will-navigate',e=>e.preventDefault());
  await panel.loadFile(path.join(__dirname,'settings.html'));return panel;
 }
 function trusted(event){if(!panel||panel.isDestroyed()||event.sender!==panel.webContents)throw Error('仅楪祈设置窗口可调用');}
 ipcMain.handle('pet:get',event=>{trusted(event);return get();});
 ipcMain.handle('pet:set',(event,patch)=>{trusted(event);return apply(patch);});
 ipcMain.handle('pet:import',event=>{trusted(event);throw Error('当前仅接入原楪祈桌宠，不导入其他角色');});
 ipcMain.handle('pet:settings',event=>{trusted(event);return open().then(()=>true);});
 return {open,publish,get,apply};
}
module.exports={createSettingsPanel};
