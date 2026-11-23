'use strict';
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getPanel:()=>settingsPanel,getWindow:()=>win,getRegions:()=>regions,movePet,relocate,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,details)=>checks.push({name,pass,details});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<120&&!api.getPanel();i++)await wait(60);
 const pet=api.getWindow(),panel=api.getPanel(),js=s=>pet.webContents.executeJavaScript(s);
 for(let i=0;i<120&&!(await js('window.inoriSmokeState().canvasReady'));i++)await wait(60);
 const paint=async()=>{await js('paint();reportRegions()');await wait(130);};
 const body=()=>{const b=pet.getBounds(),r=api.getRegions()[0]?.bubbleBounds||api.getRegions()[0],scale=b.width/300;return {x:b.x+r.x*scale,y:b.y+r.y*scale,width:r.width*scale,height:r.height*scale};};
 for(const scale of [.8,1,1.2])for(const dock of [null,'left','right','top','bottom']){
  panel.apply({quotaBadgeVisible:false,reduced:true,dockEnabled:true,dock:null,size:scale});await paint();
  const a=screen.getPrimaryDisplay().workArea;api.movePet(a.x+a.width/2-150*scale,a.y+a.height/2-280*scale);panel.apply({dock});await paint();
  if(dock!=='top'&&dock!=='bottom'){const r=api.getRegions()[0]?.bubbleBounds||api.getRegions()[0];api.movePet(pet.getBounds().x,a.y+a.height-(r.y+r.height)*scale);api.relocate(a);await paint();}
  const before=body();let onPosition=null;
  for(let cycle=0;cycle<2;cycle++)for(const visible of [true,false]){
   panel.apply({quotaBadgeVisible:visible});await paint();await paint();const after=body();
   if(visible){if(!onPosition)onPosition=after;record(`${scale}-${dock}-${cycle}-on-repeatable`,Math.abs(after.y-onPosition.y)<=2&&Math.abs(after.x-onPosition.x)<=2,{onPosition,after});}
   else record(`${scale}-${dock}-${cycle}-off-restores`,Math.abs(after.y-before.y)<=2&&Math.abs(after.x-before.x)<=2,{before,after});
  }
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});setTimeout(()=>app.exit(3),35000);
