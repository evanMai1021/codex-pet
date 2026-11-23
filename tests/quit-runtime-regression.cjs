'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.CODEX_PET_HOME||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.CODEX_PET_HOME,{recursive:true});
fs.writeFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),JSON.stringify({inoriExecutable:process.execPath,followCodex:true}));
process.argv.push('--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN,fixture=path.join(__dirname,'fixtures/quit-bridge.py');
// Substitute only the bridge script; the main process, menu and shutdown code are real.
let code=fs.readFileSync(main,'utf8').replace("path.join(__dirname,'bridge.py')",JSON.stringify(fixture));
const m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(code+'\nmodule.exports={menu,settingsPanel:()=>settingsPanel};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!m.exports.settingsPanel();i++)await wait(30);
 for(let i=0;i<100&&!fs.existsSync(path.join(out,'bridge-pids.json'));i++)await wait(30);
 fs.writeFileSync(path.join(out,'trigger.json'),JSON.stringify({at:Date.now()}));
 if(process.env.INORI_QUIT_TRIGGER==='native'){const w=await m.exports.settingsPanel().open();await w.webContents.executeJavaScript("document.getElementById('quitPet').scrollIntoView({block:'center'})");await wait(150);fs.writeFileSync(path.join(out,'native-exit.png'),(await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());await w.webContents.executeJavaScript("document.getElementById('quitPet').click()");}
 else if(process.env.INORI_QUIT_TRIGGER==='plugin'){const api=require(process.env.INORI_TEST_PLUGIN_SERVER||path.resolve(path.dirname(main),'../../plugins/codex-pet/server/index.cjs'));void api.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pet_quit',arguments:{}}});}
 else m.exports.menu().items.find(i=>i.label==='退出楪祈桌宠').click();
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});
setTimeout(()=>app.exit(3),10000).unref();
