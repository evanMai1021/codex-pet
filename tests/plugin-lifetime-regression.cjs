'use strict';
// Real native pet + real short-lived OS process; never terminates Codex itself.
const electron=require('electron'),{app,BrowserWindow}=electron,fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{spawn}=require('node:child_process');
const out=process.env.INORI_TEST_OUT,python=process.env.INORI_PYTHON;
if(!out||!python||!process.env.INORI_DATA_DIR)throw Error('Isolated paths and existing Python runtime required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs');
const under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));const native=under.require.bind(under);
let trayCalls=0,host,helper,expected=false,started=0,duplicateExited=false,wasVisible=false;
under.require=id=>id==='electron'?{...electron,Tray:class{constructor(){trayCalls++;throw Error('Notification icon must not be created');}}}:native(id);
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={takeMessage,getWindow:()=>win,getPanel:()=>settingsPanel,menu};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('before-quit',()=>{
 if(!expected)return;
 const hidden=BrowserWindow.getAllWindows().every(w=>!w.isVisible()),latencyMs=performance.now()-started,helperStillAlive=helper.exitCode===null;
 const report={mode:'actual OS child main PID exits; surviving helper; no lifecycle messages after binding',trayCalls,duplicateExited,wasVisible,hidden,helperStillAlive,latencyMs};
 report.passed=trayCalls===0&&duplicateExited&&wasVisible&&hidden&&helperStillAlive&&latencyMs<1000;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));helper.kill();
});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 api.getWindow().showInactive();wasVisible=api.getWindow().isVisible();
 if(!api.menu().items.some(i=>i.label==='退出楪祈桌宠'))throw Error('Pet context menu missing exit');
 const duplicate=spawn(process.execPath,[main,'--no-bridge','--control-only'],{windowsHide:true,stdio:'ignore',env:process.env});
 duplicate.once('exit',()=>{duplicateExited=true;});
 for(let i=0;i<40&&!duplicateExited;i++)await wait(80);
 if(!duplicateExited){duplicate.kill();throw Error('Duplicate launch did not exit');}
 host=spawn(python,['-B','-c','import time;time.sleep(30)'],{windowsHide:true,stdio:'ignore'});
 helper=spawn(python,['-B','-c','import time;time.sleep(30)'],{windowsHide:true,stdio:'ignore'});
 await Promise.all([host,helper].map(child=>new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);})));
 api.takeMessage({kind:'desktopLifecycle',running:true,mainPids:[host.pid]});
 // No bridge updates follow: native PID guard must still notice the exit.
 expected=true;started=performance.now();host.kill();
}).catch(error=>{host?.kill();helper?.kill();fs.writeFileSync(path.join(out,'error.txt'),error.stack);app.exit(2);});
setTimeout(()=>{host?.kill();helper?.kill();app.exit(3);},15000);
