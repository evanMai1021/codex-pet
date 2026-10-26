'use strict';
const e=require('electron'),{app,screen}=e,fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,relocate,movePet};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();
 for(let i=0;i<150&&!(await pet.webContents.executeJavaScript('window.inoriSmokeState().canvasReady'));i++)await wait(50);
 const measure=()=>pet.webContents.executeJavaScript(`(()=>{const c=chip.getBoundingClientRect(),r=avatar.getBoundingClientRect();return{chip:{x:c.x,y:c.y,width:c.width,height:c.height},ink:{x:r.x+ink.x*r.width/192,y:r.y+ink.y*r.height/208,width:ink.width*r.width/192,height:ink.height*r.height/208},classes:scene.className,dock:scene.dataset.dock}})()`);
 api.getSnapshot().quota={health:'preview',windows:[{label:'5小时',remaining:31},{label:'每周',remaining:89}]};
 for(const display of screen.getAllDisplays())for(const side of ['left','right'])for(const dock of [null,side,'top']){
  const a=display.workArea;api.getPanel().apply({size:1,dock:null,reduced:false,bubbleEnabled:false});api.movePet(a.x+300,a.y+30);api.getPanel().apply({dock});await wait(250);
  const local=await measure();api.movePet(side==='left'?a.x-local.ink.x:a.x+a.width-local.ink.x-local.ink.width,a.y-local.ink.y);api.relocate(a);await wait(350);
  const b=pet.getBounds(),r=await measure(),p=r.ink;
  const horizontal=side==='left'?b.x+p.x-a.x:a.x+a.width-b.x-p.x-p.width,vertical=b.y+p.y-a.y;
  checks.push({name:`corner-access-${display.id}-${side}-${dock}`,pass:Math.abs(horizontal)<=(dock==='top'?16:8)&&Math.abs(vertical)<=8,horizontal,vertical,bounds:b,measured:r});
  for(const state of ['working','waiting','completed','idle']){
   api.getSnapshot().status={state,threads:[]};api.getSnapshot().peek=state==='waiting';api.send();await wait(110);
   const r=await measure(),c=r.chip,p=r.ink,gap=dock==='bottom'?p.y-c.y-c.height:c.y-p.y-p.height;
   checks.push({name:`badge-adjacent-${display.id}-${side}-${dock}-${state}`,pass:gap>=0&&gap<=28,gap,measured:r});
  }
  api.getSnapshot().peek=false;api.getSnapshot().status={state:'idle',threads:[]};api.send();
  if(dock==='top'){
   const repaired=await pet.webContents.executeJavaScript(`(()=>{chip.style.top='528px';reportRegions();const c=chip.getBoundingClientRect(),a=avatar.getBoundingClientRect();return c.y-(a.y+(ink.y+ink.height)*a.height/208)})()`);
   checks.push({name:`top-layout-recovers-stale-badge-${display.id}-${side}`,pass:repaired>=0&&repaired<=28,gap:repaired});
   fs.writeFileSync(path.join(out,`top-${display.id}-${side}.png`),(await pet.webContents.capturePage()).toPNG());
  }
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.quit();
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);app.exit(2);});setTimeout(()=>app.exit(3),30000);
