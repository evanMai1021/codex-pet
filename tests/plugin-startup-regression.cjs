'use strict';
// Native window + real MCP process churn while a simulated desktop host stays alive.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawn}=require('node:child_process');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.CODEX_PET_HOME,{recursive:true});
fs.writeFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),JSON.stringify({inoriExecutable:process.execPath,followCodex:true}));
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs');
process.argv.push('--no-bridge','--settings-self-test');const m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={takeMessage,window:()=>win,panel:()=>settingsPanel};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];let host,child,expected=false,started=0;
function report(extra={}){fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:expected&&checks.every(c=>c.pass),checks,...extra},null,2));}
app.on('before-quit',()=>{checks.push({name:'no-quit-during-plugin-reinitialization',pass:expected});});
app.on('will-quit',()=>{const latencyMs=performance.now()-started;checks.push({name:'host-exit-hides-windows-within-600ms',pass:expected&&latencyMs<600&&BrowserWindow.getAllWindows().every(w=>!w.isVisible())});report({latencyMs});host?.kill();child?.kill();});
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!m.exports.panel();i++)await wait(50);await wait(200);m.exports.window().showInactive();
 host=spawn('C:/Program Files/nodejs/node.exe',['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
 await new Promise((r,j)=>{host.once('spawn',r);host.once('error',j);});
 for(let i=0;i<3;i++){
  if(i===1)m.exports.takeMessage({kind:'desktopLifecycle',running:true,mainPids:[host.pid]});
  child=spawn('C:/Program Files/nodejs/node.exe',[path.resolve(__dirname,'../plugins/codex-pet/server/index.cjs')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:process.env});
  await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('MCP response timeout')),5000);child.stdout.on('data',c=>{buffer+=c;if(buffer.includes('"id":1')){clearTimeout(timer);resolve();}});child.once('error',reject);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pet_settings_read',arguments:{}}})+'\n');});
  const closed=new Promise(r=>child.once('exit',r));child.stdin.end();await closed;await wait(400);
  checks.push({name:'same-native-window-visible-after-reconnect-'+i,pass:m.exports.window().isVisible()});
 }
 expected=true;started=performance.now();host.kill();
}).catch(e=>{checks.push({name:'harness',pass:false,error:e.message});report();host?.kill();child?.kill();app.exit(2);});
setTimeout(()=>{checks.push({name:'timeout',pass:false});report();host?.kill();child?.kill();app.exit(3);},12000);
