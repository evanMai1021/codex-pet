'use strict';
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s),area=screen.getPrimaryDisplay().workArea;
 await wait(400);pet.showInactive();
 api.getSnapshot().status={state:'working',title:'模拟任务 · 避让公仔验证',phase:'检查气泡位置',threads:[{}]};
 for(const size of [.8,1.2])for(const dock of [null,'left','right','top','bottom']){
  api.getPanel().apply({size,dockEnabled:true,dock,bubbleEnabled:true,bubbleScale:1.4});
  if(!dock)pet.setPosition(area.x+Math.round(area.width/2-150*size),area.y+Math.round(area.height/2-280*size));
  for(const peeking of [false,true]){
   await js(`overlayUntil=${peeking?'Date.now()+10000':'0'};paint();reportRegions()`);api.send();await wait(400);api.updateTaskBubble();await wait(100);api.updateTaskBubble();
   const sprite=await js("(()=>{const r=avatar.getBoundingClientRect(),s=innerWidth/300;return{x:r.x+ink.x*s,y:r.y+ink.y*s,width:ink.width*s,height:ink.height*s,peek:scene.classList.contains('peek')};})()"),pb=pet.getBounds();
   const body={x:pb.x+sprite.x,y:pb.y+sprite.y,width:sprite.width,height:sprite.height};
   const bubble=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡'),b=bubble?.getBounds();
   const separated=b&&(b.x+b.width<=body.x||b.x>=body.x+body.width||b.y+b.height<=body.y||b.y>=body.y+body.height);
   checks.push({name:`avoid-${size}-${dock||'free'}-${peeking?'peek':'rest'}`,pass:!!bubble?.isVisible()&&!!separated,body,bubble:b,peek:sprite.peek});
   checks.push({name:`inside-screen-${size}-${dock}-${peeking}`,pass:b&&b.x>=area.x&&b.y>=area.y&&b.x+b.width<=area.x+area.width&&b.y+b.height<=area.y+area.height});
  }
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual Electron windows and renderer visible alpha rectangles; synthetic task; both sizes, all docking edges and peek states',checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),45000);
