'use strict';
// Native renderer benchmark, synthetic states, no account/status access.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={snapshot,send,getWindow:()=>win,getPanel:()=>settingsPanel};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(100);
 const win=api.getWindow(),js=s=>win.webContents.executeJavaScript(s),results=[];win.showInactive();
 for(const skin of ['redwhite','battle']){
  api.getPanel().apply({skin,dock:null,reduced:false});
  for(let i=0;i<100;i++){if(await js(`window.inoriSmokeState().skin===${JSON.stringify(skin)}&&!window.inoriSmokeState().pendingSkin`))break;await wait(80);}
  api.snapshot.status={state:'working',label:'模拟性能检查',threads:[]};api.send();await wait(300);
  const result=await js(`new Promise(resolve=>{const deltas=[],before=inoriRenderStats();let last=performance.now(),start=last;function tick(now){deltas.push(now-last);last=now;if(now-start<6500)requestAnimationFrame(tick);else{const after=inoriRenderStats(),sorted=deltas.slice(2).sort((a,b)=>a-b);resolve({durationMs:now-start,callbacks:deltas.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...sorted),longFrames:sorted.filter(x=>x>50).length,paints:after.paintCount-before.paintCount,readbacks:after.readbackCount-before.readbackCount});}}requestAnimationFrame(tick);})`);
  results.push({skin,...result});
 }
 fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify({mode:'actual Electron renderer; simulated working state',results},null,2));app.exit(0);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),35000);
