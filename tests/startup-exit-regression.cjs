'use strict';
const {app,session}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.CODEX_PET_HOME,{recursive:true});fs.writeFileSync(path.join(process.env.CODEX_PET_HOME,'runtime.json'),JSON.stringify({inoriExecutable:process.execPath,followCodex:true}));
process.argv.push('--no-bridge');let createdAt,visibleBeforePaint=false,firstPaintMs=null,exitAt=null,timedOut=false,shows=0,hides=0,startupShows=0,startupHides=0,api;
app.on('browser-window-created',(_e,w)=>{if(createdAt)return;createdAt=Date.now();visibleBeforePaint=w.isVisible();w.on('show',()=>shows++);w.on('hide',()=>hides++);});
app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['file://*/*']},(details,callback)=>{if(details.url.includes('continuous-doze-'))setTimeout(()=>callback({}),1800);else callback({});}));
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,takeMessage};',main);api=m.exports;
const wait=ms=>new Promise(r=>setTimeout(r,ms));let tick;
app.on('before-quit',()=>{
 if(!exitAt)return;
 clearInterval(tick);const quitDelayMs=Date.now()-exitAt;
 const checks=[{name:'unrelated-slow-asset-does-not-block-first-paint',pass:firstPaintMs!==null&&firstPaintMs<1000},{name:'window-hidden-until-first-content',pass:!visibleBeforePaint},{name:'startup-does-not-hide-and-reshow',pass:startupShows<=1&&startupHides===0},{name:'explicit-desktop-window-exit-does-not-wait-for-background-main',pass:!timedOut&&quitDelayMs<1500}];
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),firstPaintMs,visibleBeforePaint,shows:startupShows,hides:startupHides,quitDelayMs,simulatedHostExit:true,checks},null,2));
});
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!api.getWindow();i++)await wait(20);const w=api.getWindow();
 for(let i=0;i<200;i++){await wait(25);try{const painted=await w.webContents.executeJavaScript("window.inoriSmokeState?.().canvasReady&&window.inoriRenderStats?.().paintCount>0");if(!painted&&w.isVisible())visibleBeforePaint=true;if(painted){firstPaintMs=Date.now()-createdAt;break;}}catch{}}
 const {spawn}=require('node:child_process');
 await Promise.all([1,2,3].map(()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve(__dirname,'..'),'--codex-autostart'],{env:process.env,windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('exit',resolve);})));await wait(150);
 await wait(150);api.takeMessage({kind:'desktopLifecycle',running:true,mainPids:[process.pid],mainWindowPresent:true});await wait(250);startupShows=shows;startupHides=hides;exitAt=Date.now();
 tick=setInterval(()=>api.takeMessage({kind:'desktopLifecycle',running:true,mainPids:[process.pid],mainWindowPresent:false}),100);
 setTimeout(()=>{if(!app.isQuitting){timedOut=true;app.quit();}},2100).unref();
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.quit();});
setTimeout(()=>app.quit(),12000).unref();
