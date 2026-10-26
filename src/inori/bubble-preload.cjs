'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('taskBubble',{onUpdate:callback=>ipcRenderer.on('bubble:update',(_e,value)=>callback(value)),cycle:()=>ipcRenderer.send('bubble:cycle'),page:value=>ipcRenderer.send('bubble:page',value),thread:value=>ipcRenderer.send('bubble:thread',value),dismiss:()=>ipcRenderer.send('bubble:dismiss'),refresh:()=>ipcRenderer.send('bubble:refresh'),confirm:()=>ipcRenderer.send('bubble:confirm')});
