'use strict';
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();
 api.getSnapshot().status={state:'working',title:'模拟任务 · 气泡距离',phase:'验证间距',threads:[{}]};api.send();
 for(const skin of ['redwhite','battle'])for(const dock of ['right','left']){
  api.getPanel().apply({skin,dockEnabled:true,dock,size:1,bubbleScale:1,bubbleEnabled:true});
  for(let i=0;i<100;i++){await wait(50);if(await pet.webContents.executeJavaScript(`skinReady&&activeSkin==='${skin}'`))break;}
  await pet.webContents.executeJavaScript('overlayUntil=0;paint();reportRegions()');await wait(400);api.updateTaskBubble();await wait(150);api.updateTaskBubble();
  const measure=async()=>{const b=pet.getBounds(),r=await pet.webContents.executeJavaScript("(()=>{const r=avatar.getBoundingClientRect(),s=innerWidth/300;return{x:r.x+ink.x*s,y:r.y+ink.y*s,width:ink.width*s,height:ink.height*s};})()");return{x:b.x+r.x,y:b.y+r.y,width:r.width,height:r.height};};
  const body=await measure(),bubble=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡'),b=bubble.getBounds(),gap=dock==='right'?body.x-b.x-b.width:b.x-body.x-body.width;
  checks.push({name:`close-${skin}-${dock}`,pass:bubble.isVisible()&&gap>=0&&gap<=36,gap,body,bubble:b});
  const first=bubble.getBounds();for(let i=0;i<10;i++){await wait(30);api.updateTaskBubble();}checks.push({name:`stable-${skin}-${dock}`,pass:JSON.stringify(first)===JSON.stringify(bubble.getBounds())});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual windows, actual visible alpha bounds, synthetic task',checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),25000);
