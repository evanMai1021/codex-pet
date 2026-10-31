'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getMenu:menu,getRegions:()=>regions,getPanel:()=>settingsPanel,getWindow:()=>win,getSnapshot:()=>snapshot,getBubble:()=>taskBubble,send,updateTaskBubble};',main);
const checks=[],record=(name,pass)=>checks.push({name,pass}),wait=ms=>new Promise(r=>setTimeout(r,ms));
function finish(code){process.exitCode=code;app.quit();}const deadline=setTimeout(()=>finish(3),30000);deadline.unref();
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<80&&!api.getPanel();i++)await wait(50);
 const panel=api.getPanel(),snap=api.getSnapshot(),pet=api.getWindow();pet.showInactive();await wait(250);
 for(let i=0;i<80;i++){if(await pet.webContents.executeJavaScript("!!document.getElementById('chip')&&window.inoriSmokeState().canvasReady"))break;await wait(50);}
 record('badge-default-visible',panel.get().settings.quotaBadgeVisible===true&&await pet.webContents.executeJavaScript("!document.getElementById('chip').hidden"));
 panel.apply({quotaBadgeVisible:false});await wait(180);
 record('badge-hidden-by-setting',await pet.webContents.executeJavaScript("document.getElementById('chip').hidden&&getComputedStyle(document.getElementById('chip')).display==='none'"));
 record('hidden-badge-has-no-hit-region',!api.getRegions().some(r=>r.kind==='chip'));
 record('quota-context-menu-options-removed',!api.getMenu().items.some(i=>['查看剩余额度','显示公仔下方额度条'].includes(i.label)));
 panel.apply({quotaBadgeVisible:true});await wait(160);
 record('settings-restores-badge',panel.get().settings.quotaBadgeVisible===true&&await pet.webContents.executeJavaScript("!document.getElementById('chip').hidden"));
 panel.apply({quotaBadgeVisible:false});await wait(100);
 record('completion-setting-removed',!('completionNotify' in panel.get().settings));
 let rejected=false;try{panel.apply({completionNotify:true});}catch{rejected=true;}record('removed-setting-rejected',rejected);
 panel.apply({bubbleEnabled:false});snap.status={state:'working',threadId:'test',turnId:'t1',threads:[{state:'working',threadId:'test',turnId:'t1'}]};api.send();api.updateTaskBubble();await wait(150);
 snap.status={state:'completed',threadId:'test',turnId:'t1',terminalAt:Date.now(),threads:[{state:'completed',threadId:'test',turnId:'t1',terminalAt:Date.now()}]};api.send();api.updateTaskBubble();await wait(250);
 record('no-independent-completion-popup',!api.getBubble().getWindow()?.isVisible());
 api.getBubble().open('task');api.updateTaskBubble();for(let i=0;i<80;i++){await wait(50);const w=api.getBubble().getWindow();if(w?.isVisible()&&!w.webContents.isLoading())break;}
 const w=api.getBubble().getWindow(),js=s=>w.webContents.executeJavaScript(s);
 record('draft-and-notice-ui-removed',await js("!document.getElementById('composer')&&!document.getElementById('notices')&&!document.getElementById('draft')"));
 record('draft-and-notice-bridge-removed',await js("['draft','copy','openThread','notice','target','busy'].every(k=>!(k in window.taskBubble))"));
 api.getBubble().open('quota');api.updateTaskBubble();await wait(100);
 snap.quota={health:'preview',accountLabel:'演示账户',windows:[{label:'5小时',remaining:27,resetsAt:Date.parse('2026-10-31T21:24:00+08:00')/1000},{label:'每周',remaining:65,resetsAt:Date.parse('2026-11-05T02:05:00+08:00')/1000}]};api.send();api.updateTaskBubble();await wait(120);
 record('detail-page-has-no-style-number',await js("!document.getElementById('quota-style-label')&&!document.getElementById('page-quota').textContent.includes('样式')"));
 record('old-expand-toggle-removed',await js("!document.getElementById('quota-toggle')")&&!('quotaExpanded' in panel.get().settings));
 let badStyle=false;try{panel.apply({quotaStyle:'invalid'});}catch{badStyle=true;}record('invalid-style-rejected',badStyle);
 for(const style of ['style1','style2']){
  panel.apply({quotaStyle:style});await wait(150);api.updateTaskBubble();await wait(100);
  const selector=style==='style1'?'#quota-summary':'#quota-details';
  record(style+'-has-correct-layout',await js(`!document.querySelector('${selector}').hidden&&document.querySelector('${selector}').textContent.includes('27%')`));
  record(style+'-reset-times-readable',await js(`[...document.querySelectorAll('${selector} .quota-reset time')].length===2&&[...document.querySelectorAll('${selector} .quota-reset time')].every(t=>parseFloat(getComputedStyle(t).fontSize)>=12)&&document.querySelector('${selector}').textContent.includes('21:24')&&document.querySelector('${selector}').textContent.includes('02:05')`));
  fs.writeFileSync(path.join(out,style+'.png'),(await w.webContents.capturePage()).toPNG());
  for(const scale of [.8,1,1.2,1.4]){panel.apply({bubbleScale:scale});await wait(150);api.updateTaskBubble();await wait(100);record(style+'-fits-'+scale,await js("document.querySelector('.pages').scrollWidth<=document.querySelector('.pages').clientWidth+2"));}
  panel.apply({bubbleScale:1});snap.quota={health:'unavailable',windows:[]};api.send();api.updateTaskBubble();await wait(100);
  record(style+'-unknown-values-and-time',await js(`document.querySelector('${selector}').textContent.includes('—')&&document.querySelector('${selector} .quota-reset time').textContent==='时间待更新'`));
  snap.quota={health:'preview',accountLabel:'演示账户',windows:[{label:'5小时',remaining:27,resetsAt:Date.parse('2026-10-31T21:24:00+08:00')/1000},{label:'每周',remaining:65,resetsAt:Date.parse('2026-11-05T02:05:00+08:00')/1000}]};api.send();api.updateTaskBubble();await wait(100);
 }
 record('three-pages-retained',await js("document.querySelectorAll('[role=tab]').length===3"));
 fs.writeFileSync(path.join(out,'quota.png'),(await w.webContents.capturePage()).toPNG());await wait(400);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));clearTimeout(deadline);finish(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);clearTimeout(deadline);finish(2);});
