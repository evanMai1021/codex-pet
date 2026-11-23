'use strict';
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8').replace('createTaskBubble({onRefresh:','createTaskBubble({hidden:true,onRefresh:')+'\nupdateTaskBubble=()=>{};module.exports={getPanel:()=>settingsPanel,getBubble:()=>taskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass)=>checks.push({name,pass});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(70);
 const panel=api.getPanel(),bubble=api.getBubble(),a=screen.getPrimaryDisplay().workArea,anchor={x:a.x+Math.round(a.width/2),y:a.y+Math.round(a.height/2),width:100,height:120};
 panel.apply({bubbleEnabled:false});
 let state='idle';
 const update=async(next,thread=true,updatedAt)=>{state=next;bubble.update({status:{state:next,updatedAt,...(thread&&next!=='idle'?{threadId:'fixture-thread',turnId:'fixture-turn'}:{}),threads:[]}},anchor,true,panel.get().settings);await wait(120);};
 const js=s=>bubble.getWindow().webContents.executeJavaScript(s);
 const selected=page=>js(`document.querySelector('[data-page=${page}]').getAttribute('aria-selected')==='true'`);
 for(const pinned of ['task','quota','usage']){
  panel.apply({bubblePinnedPage:pinned});await update('idle');for(let i=0;i<40;i++){if(await selected(pinned))break;await wait(70);}
  record(pinned+'-idle-shows-selection',await selected(pinned));
  await update('working');record(pinned+'-task-switches-to-task',await selected('task'));
  await update('waiting');record(pinned+'-waiting-stays-task',await selected('task'));
  await update('completed');record(pinned+'-completion-restores-selection',await selected(pinned));
  await update('idle');record(pinned+'-idle-retains-selection',await selected(pinned));
  await update('unknown',false);record(pinned+'-missing-task-retains-selection',await selected(pinned));
  await update('unknown',true,Date.now());record(pinned+'-fresh-uncertain-task-shows-task',await selected('task'));
  await update('unknown',true,Date.now()-200000);record(pinned+'-stale-uncertain-task-does-not-hijack-pin',await selected(pinned));
 }
 panel.apply({bubblePinnedPage:'quota'});await update('idle');
 await js("document.querySelector('[data-page=usage]').click()");await wait(100);record('manual-navigation-still-works',await selected('usage'));
 await update('working');await update('idle');record('task-ends-return-to-configured-page',await selected('quota'));
 await wait(350);record('pinned-selection-saved',JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8')).bubblePinnedPage==='quota');
 await js("document.getElementById('dismiss').click()");await wait(350);record('close-disables-pinned-and-auto',panel.get().settings.bubblePinnedPage==='off'&&panel.get().settings.bubbleEnabled===false);
 record('close-is-persisted',JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8')).bubblePinnedPage==='off');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'real bubble renderer and settings, simulated task transitions',checks},null,2));bubble.close();app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});setTimeout(()=>app.exit(3),20000);
