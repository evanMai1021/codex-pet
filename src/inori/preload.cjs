'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('inori',{
  get:()=>ipcRenderer.invoke('inori:get'),usageToggle:()=>ipcRenderer.send('inori:usage-toggle'),
  onSnapshot:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('inori:snapshot',listener);return ()=>ipcRenderer.removeListener('inori:snapshot',listener);},
  regions:value=>ipcRenderer.send('inori:regions',value),hover:value=>ipcRenderer.send('inori:hover',value),
  interact:()=>ipcRenderer.send('inori:interact'),press:()=>ipcRenderer.send('inori:press'),drag:()=>ipcRenderer.send('inori:drag'),release:()=>ipcRenderer.send('inori:release'),
  menu:()=>ipcRenderer.send('inori:menu'),refresh:()=>ipcRenderer.send('inori:refresh'),confirmAccount:value=>ipcRenderer.send('inori:confirmAccount',value)
});
