'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('taskBubble',{onUpdate:callback=>ipcRenderer.on('bubble:update',(_e,value)=>callback(value)),cycle:()=>ipcRenderer.send('bubble:cycle'),settings:()=>ipcRenderer.send('bubble:settings')});
