'use strict';
// Real MCP stdin shutdown and real native windows; leaves Codex itself running.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawn}=require('node:child_process');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.CODEX_PET_HOME,{recursive:true});
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs');
fs.writeFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),JSON.stringify({inoriExecutable:process.execPath,followCodex:true}));
process.argv.push('--no-bridge','--settings-self-test');const m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={takeMessage,window:()=>win,panel:()=>settingsPanel};',main);
let child,host,started=0,expected=false,visible=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));
let exitEvidence;
app.on('before-quit',()=>{if(!expected||exitEvidence)return;exitEvidence={latencyMs:performance.now()-started,hidden:BrowserWindow.getAllWindows().every(w=>!w.isVisible()),visible};});
app.on('will-quit',()=>{host?.kill();if(!exitEvidence){fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,reason:'premature quit while host alive'}));return;}const checks=[{name:'all-windows-hide-within-500ms',pass:exitEvidence.hidden&&exitEvidence.latencyMs<500},{name:'pet-was-visible-after-plugin-pipe-closed',pass:visible},{name:'graceful-will-quit-reached',pass:true}];fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...exitEvidence,passed:checks.every(c=>c.pass),checks,mode:'real MCP stdin closed; pet remains until simulated desktop host exits'}));});
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!m.exports.panel();i++)await wait(50);m.exports.window().showInactive();visible=m.exports.window().isVisible();
 host=spawn('C:/Program Files/nodejs/node.exe',['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
 await new Promise((r,j)=>{host.once('spawn',r);host.once('error',j);});
 m.exports.takeMessage({kind:'desktopLifecycle',running:true,mainPids:[host.pid]});
 const server=process.env.INORI_TEST_PLUGIN_SERVER||path.resolve(__dirname,'../plugins/codex-pet/server/index.cjs');
 child=spawn('C:/Program Files/nodejs/node.exe',[server],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:process.env});
 let closing=false,buffer='';child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.includes('"id":1')&&!closing){closing=true;child.stdin.end();}});
 child.once('exit',async()=>{await wait(300);visible=visible&&m.exports.window().isVisible();expected=true;started=performance.now();host.kill();});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pet_settings_read',arguments:{}}})+'\n');
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});
setTimeout(()=>{host?.kill();child?.kill();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:false,reason:'pet still visible after desktop host exited'}));app.exit(3);},10000);
