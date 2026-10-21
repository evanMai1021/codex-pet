'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pet',{get:()=>ipcRenderer.invoke('pet:get'),set:patch=>ipcRenderer.invoke('pet:set',patch),importSkin:()=>ipcRenderer.invoke('pet:import'),openSettings:()=>ipcRenderer.invoke('pet:settings'),onUpdate:cb=>ipcRenderer.on('pet:update',(_e,value)=>cb(value))});
