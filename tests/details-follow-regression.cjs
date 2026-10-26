'use strict';
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getDetails:()=>detailsWindow,getSnapshot:()=>snapshot,send,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow(),area=screen.getPrimaryDisplay().workArea;
 await wait(500);api.getPanel().apply({dock:null,size:1,bubbleEnabled:true,bubbleScale:1,detailsScale:1});pet.setPosition(area.x+400,area.y+60);pet.showInactive();
 api.getSnapshot().status={state:'working',title:'模拟任务 · 详情跟随验证',phase:'检查位置',threads:[{}]};api.send();await wait(300);
 api.getPanel().apply({detailsVisible:true});await wait(600);api.updateTaskBubble();const detail=api.getDetails().getWindow(),before=detail.getBounds(),pb=pet.getBounds();
 pet.setPosition(pb.x+70,pb.y+30);await wait(300);const after=detail.getBounds();
 checks.push({name:'details-follow-pet-drag',pass:after.x-before.x===70&&after.y-before.y===30,before,after});
 for(const dock of [null,'left','right','top','bottom'])for(const scale of [1,1.6])for(const peek of [false,true]){
  api.getPanel().apply({dockEnabled:true,dock,detailsScale:scale});await wait(350);api.updateTaskBubble();await wait(80);
  await pet.webContents.executeJavaScript(`overlayUntil=${peek?'Date.now()+10000':'0'};paint();reportRegions()`);await wait(280);api.updateTaskBubble();
  const b=pet.getBounds(),r=await pet.webContents.executeJavaScript("(()=>{const r=avatar.getBoundingClientRect(),s=innerWidth/300;return{x:r.x+ink.x*s,y:r.y+ink.y*s,width:ink.width*s,height:ink.height*s};})()"),body={x:b.x+r.x,y:b.y+r.y,width:r.width,height:r.height},d=detail.getBounds();
  const bubble=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡');
  checks.push({name:`details-avoid-pet-${dock}-${scale}-${peek}`,pass:detail.isVisible()&&!overlap(d,body),details:d,body});
  checks.push({name:`details-inside-screen-${dock}-${scale}-${peek}`,pass:d.x>=area.x&&d.y>=area.y&&d.x+d.width<=area.x+area.width&&d.y+d.height<=area.y+area.height});
  checks.push({name:`windows-avoid-each-other-${dock}-${scale}-${peek}`,pass:!bubble?.isVisible()||!overlap(d,bubble.getBounds())});
 }
 api.getPanel().apply({visible:false});await wait(200);checks.push({name:'hidden-pet-hides-details',pass:!detail.isVisible()});api.getPanel().apply({visible:true});await wait(200);checks.push({name:'show-pet-restores-details',pass:detail.isVisible()});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual main process and native windows; synthetic task',checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),25000);
