'use strict';
// Explicit read-only live local-rollout check; no prompts or approvals are sent.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getSnapshot:()=>snapshot};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<200&&!api.getSnapshot().dailyUsage;i++)await wait(100);
 const usage=api.getSnapshot().dailyUsage;if(!usage)throw Error('No daily usage received from actual bridge');
 await wait(300);const text=await api.getWindow().webContents.executeJavaScript('document.getElementById("token-total").textContent');
 const ready=['ready','partial'].includes(usage.health),matches=ready&&text===new Intl.NumberFormat('zh-CN').format(usage.totalTokens);
 const report={passed:matches,mode:'actual packaged Python bridge to Electron renderer; local usage records',usage,renderedTotal:text,accountsExported:false,chatBodiesExported:false};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.quit();
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.quit();});setTimeout(()=>app.exit(3),35000);
