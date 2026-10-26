'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,updateTaskBubble,setRegions:v=>regions=v};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass)=>checks.push({name,pass});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);await wait(400);api.getPanel().apply({dock:null,size:1,bubbleEnabled:true});pet.setPosition(350,80);pet.showInactive();
 const snapshot=api.getSnapshot();snapshot.status={state:'working',label:'模拟工作状态',title:'模拟任务 · 固定气泡验证',phase:'正在验证',threads:[{}]};
 snapshot.quota={health:'preview',windows:[{label:'5小时',remaining:62,resetsAt:1792800000},{label:'每周',remaining:86,resetsAt:1793000000}],updatedAt:Date.now()};
 snapshot.dailyUsage={health:'ready',date:'2026-10-23',inputTokens:12000,outputTokens:345,cachedInputTokens:10000,totalTokens:12345};api.send();await wait(400);api.setRegions([{x:80,y:330,width:100,height:180}]);api.updateTaskBubble();
 let bubble;for(let i=0;i<60&&!bubble;i++){await wait(80);api.updateTaskBubble();bubble=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡');}if(!bubble)throw Error('Bubble did not open');await wait(200);api.updateTaskBubble();const first=bubble.getBounds();
 for(let i=0;i<30;i++){api.setRegions([{x:60+i,y:320+i%6,width:120-i,height:170+i%8}]);api.updateTaskBubble();record('animated-ink-fixed-anchor-'+i,JSON.stringify(bubble.getBounds())===JSON.stringify(first));}
 const petBefore=pet.getBounds();pet.setPosition(petBefore.x+40,petBefore.y);api.updateTaskBubble();record('user-movement-repositions-bubble',bubble.getBounds().x!==first.x||bubble.getBounds().y!==first.y);
 await js('pinned=true;layout();paint();document.getElementById("avatar").focus()');await wait(150);
 record('no-rectangular-avatar-focus-border',await js("getComputedStyle(document.getElementById('avatar')).outlineStyle==='none'"));
 record('details-contain-only-quota-and-usage',await js("!document.getElementById('state-label')&&!document.getElementById('thread-label')&&!document.getElementById('phase-label')&&!document.getElementById('capability')&&document.getElementById('quota-detail').textContent.includes('5小时')"));
 record('local-today-total-and-breakdown',await js("document.getElementById('token-total').textContent==='12,345'&&document.getElementById('token-breakdown').textContent.includes('12,000')&&document.getElementById('token-scope').textContent.includes('香港时间')"));
 record('task-information-in-bubble',await bubble.webContents.executeJavaScript("document.getElementById('title').textContent.includes('固定气泡验证')&&document.getElementById('stage').textContent==='正在验证'"));
 await pet.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(80);fs.writeFileSync(path.join(out,'quota-details.png'),(await pet.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 snapshot.dailyUsage={health:'unavailable',totalTokens:null};api.send();await wait(80);record('unknown-usage-is-not-zero',await js("document.getElementById('token-total').textContent==='暂不可用'"));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual main/renderers with synthetic task, quota and usage',checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),20000);
