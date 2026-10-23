'use strict';
require('electron').contextBridge.exposeInMainWorld('testHost',{call:m=>require('electron').ipcRenderer.invoke('test:embedded',m)});
