'use strict';
// Real MCP stdin shutdown and real native windows; leaves Codex itself running.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawn}=require('node:child_process');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.CODEX_PET_HOME,{recursive:true});
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs');
fs.writeFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),JSON.stringify({inoriExecutable:process.execPath,followCodex:true}));
process.argv.push('--no-bridge','--settings-self-test');const m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={window:()=>win,panel:()=>settingsPanel};',main);
let child,started=0,expected=false,visible=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('before-quit',()=>{if(!expected)return;const latencyMs=performance.now()-started,hidden=BrowserWindow.getAllWindows().every(w=>!w.isVisible());fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:hidden&&visible&&latencyMs<500,latencyMs,hidden,visible,mode:'real MCP stdin closed while desktop host remains alive'}));});
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!m.exports.panel();i++)await wait(50);m.exports.window().showInactive();visible=m.exports.window().isVisible();
 const server=process.env.INORI_TEST_PLUGIN_SERVER||path.resolve(__dirname,'../plugins/codex-pet/server/index.cjs');
 child=spawn('C:/Program Files/nodejs/node.exe',[server],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:process.env});
 let buffer='';child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.includes('"id":1')&&!expected){expected=true;started=performance.now();child.stdin.end();}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pet_settings_read',arguments:{}}})+'\n');
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});
setTimeout(()=>{child?.kill();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,reason:'pet still visible after plugin connection closed'}));app.exit(3);},10000);
