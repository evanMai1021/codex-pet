'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass)=>checks.push({name,pass});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow(),original=pet.getBounds(),anchor={x:500,y:300,width:150,height:180};
 const bubble=require('../src/inori/task-bubble.cjs').createTaskBubble({hidden:true}),snapshot={status:{state:'working',title:'模拟任务 · 独立气泡大小',phase:'正在验证',threads:[{}]}};
 bubble.update(snapshot,anchor,true);await wait(200);bubble.update(snapshot,anchor,true);
 const win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡');
 for(const scale of [.8,1,1.2,1.4]){
  api.getPanel().apply({bubbleScale:scale});bubble.update(snapshot,anchor,true,{bubbleScale:scale});await wait(150);
  const bounds=win.getBounds();record('native-size-'+scale,bounds.width===Math.round(300*scale)&&bounds.height===Math.round(328*scale));
  record('text-zoom-'+scale,Math.abs(win.webContents.getZoomFactor()-scale)<.001);
  record('pet-unchanged-'+scale,JSON.stringify(pet.getBounds())===JSON.stringify(original));
  record('content-fits-'+scale,await win.webContents.executeJavaScript('document.documentElement.scrollWidth<=innerWidth+1'));
  if(scale===.8||scale===1.4){await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(80);fs.writeFileSync(path.join(out,'bubble-'+scale+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
 }
 const bubbleBounds=win.getBounds();api.getPanel().apply({size:.8});bubble.update(snapshot,anchor,true,{bubbleScale:1.4});
 record('pet-size-does-not-change-bubble',win.getBounds().width===bubbleBounds.width&&win.getBounds().height===bubbleBounds.height);
 await wait(350);const saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));
 record('independent-settings-persisted',saved.size===.8&&saved.bubbleScale===1.4);
 bubble.update({...snapshot,status:{state:'waiting',approvalPending:true,threads:[]}},anchor,true,{bubbleScale:1.4});
 record('approval-keeps-pager-height',win.getBounds().height===Math.round(328*1.4));
 const report={passed:checks.every(c=>c.pass),mode:'actual native bubble geometry and text zoom; simulated task',checks};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));bubble.close();app.exit(report.passed?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),20000);
