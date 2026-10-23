'use strict';
// Actual iframe -> MCP handler -> authenticated loopback -> actual native settings.
// Only the Codex host bridge is simulated; no live account/status source is used.
const electron=require('electron'),{app,BrowserWindow,ipcMain}=electron,fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Use isolated test paths');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.CODEX_PET_HOME,{recursive:true});
fs.writeFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),JSON.stringify({inoriExecutable:process.execPath,followCodex:false}));
process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs');
const under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getPanel:()=>settingsPanel,getWindow:()=>win,getSnapshot:()=>snapshot};',main);
const api=under.exports,server=require('../plugins/codex-pet/server/index.cjs'),wait=ms=>new Promise(r=>setTimeout(r,ms));
let window;
ipcMain.handle('test:embedded',(event,m)=>{if(event.sender!==window.webContents)throw Error('Unknown host');return server.handle(m);});
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!fs.existsSync(path.join(process.env.INORI_DATA_DIR,'settings-control.json'));i++)await wait(100);
 const html=fs.readFileSync(path.resolve(__dirname,'../plugins/codex-pet/ui/control.html'),'utf8');
 const wrapper=`<!doctype html><style>body{margin:0;background:#161719}iframe{border:0;width:100vw;height:100vh}</style><iframe id="panel"></iframe><script>
 window.calls=[];window.rejectNext=false;
 addEventListener('message',async e=>{const m=e.data;if(e.source!==document.getElementById('panel').contentWindow||m.id===undefined)return;let response;
 if(m.method==='ui/initialize')response={jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2026-01-26',hostCapabilities:{}}};
 else{calls.push(m);if(rejectNext&&m.params?.name==='pet_settings_update'){rejectNext=false;response={jsonrpc:'2.0',id:m.id,result:{isError:true,content:[{type:'text',text:'测试连接错误'}]}};}else response=await testHost.call(m);}
 e.source.postMessage(response,'*');});document.getElementById('panel').srcdoc=${JSON.stringify(html).replace(/</g,'\\u003c')};</script>`;
 const wrapperFile=path.join(out,'embedded-host.html');fs.writeFileSync(wrapperFile,wrapper);
 window=new BrowserWindow({width:980,height:1100,show:false,webPreferences:{preload:path.join(__dirname,'embedded-settings-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 await window.loadFile(wrapperFile);const js=s=>window.webContents.executeJavaScript(s),doc="document.getElementById('panel').contentWindow.document";
 const checks=[],record=(name,pass)=>checks.push({name,pass});
 for(let i=0;i<100;i++){if(await js(`!${doc}.getElementById('skin').disabled`))break;await wait(100);}
 record('all-ten-settings-enabled-without-native-settings-window',await js(`${doc}.querySelectorAll('.row input,.row select').length===10&&!${doc}.getElementById('skin').disabled`)&&BrowserWindow.getAllWindows().length===2);
 record('native-pet-remains-hidden-when-reading',!api.getWindow().isVisible());
 record('no-open-settings-button',await js(`!${doc}.getElementById('open')&&![...${doc}.querySelectorAll('button')].some(b=>b.textContent==='打开设置')`));
 async function change(id,value){await js(`{const el=${doc}.getElementById(${JSON.stringify(id)});el[el.type==='checkbox'?'checked':'value']=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));}`);await wait(400);}
 for(const [id,value,expected] of [['skin','battle','battle'],['size','80',.8],['reduced',true,true],['followCodex',true,true],['bubbleEnabled',false,false],['bubbleTone','simple','simple'],['bubbleCustomLine','陪你一起完成♡','陪你一起完成♡'],['dockEnabled',true,true],['dock','top','top']]){
  await change(id,value);record('live-setting-'+id,api.getPanel().get().settings[id]===expected);
 }
 record('native-size-applied',api.getWindow().getBounds().width===Math.round(300*.8));
 await change('visible',true);record('show-native-pet',api.getWindow().isVisible());await change('visible',false);
 await change('dockEnabled',false);record('dock-disabled-clears-current-edge',api.getPanel().get().settings.dock===null&&await js(`${doc}.getElementById('dock').disabled`));
 await js(`${doc}.querySelector('details').open=true;${doc}.getElementById('bubblePhraseState').value='working';${doc}.getElementById('bubblePhraseState').dispatchEvent(new Event('change'));`);
 record('phrase-list-shares-runtime-and-custom-line',await js(`${doc}.getElementById('bubblePhraseList').textContent.includes('陪你一起完成♡')`));
 await change('bubbleTone','cute');record('phrase-list-keeps-selected-state-and-expansion',await js(`${doc}.querySelector('details').open&&${doc}.getElementById('bubblePhraseState').value==='working'&&${doc}.getElementById('bubbleTone').options.length===2`));
 await js('rejectNext=true');await change('skin','redwhite');record('failed-save-rolls-back-and-reenables',await js(`${doc}.getElementById('skin').value==='battle'&&!${doc}.getElementById('skin').disabled&&${doc}.getElementById('message').classList.contains('error')`));
 const response=await server.handle({jsonrpc:'2.0',id:8,method:'tools/call',params:{name:'pet_settings_update',arguments:{set:{size:1,visible:'bad'}}}});
 record('invalid-mixed-patch-is-atomic',response.result.isError===true&&api.getPanel().get().settings.size===.8);
 const compat=await server.handle({jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'pet_open_settings',arguments:{}}});
 record('legacy-tool-now-returns-embedded-settings',!!compat.result.structuredContent?.schema&&BrowserWindow.getAllWindows().length===2);
 const saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));
 record('settings-persisted',saved.skin==='battle'&&saved.size===.8&&saved.bubbleCustomLine==='陪你一起完成♡'&&saved.dockEnabled===false);
 record('follow-codex-persisted-separately',JSON.parse(fs.readFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),'utf8')).followCodex===true);
 await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(150);fs.writeFileSync(path.join(out,'embedded-settings.png'),(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 window.setSize(430,1000);await wait(100);record('narrow-layout-no-horizontal-overflow',await js(`${doc}.documentElement.scrollWidth<=${doc}.documentElement.clientWidth`));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual-iframe-MCP-loopback-native-settings; simulated-Codex-host',checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});
setTimeout(()=>app.exit(3),35000);
