'use strict';
// Count native mutations over time: a screenshot alone cannot catch repeated repainting.
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getDetails:()=>detailsWindow,getSnapshot:()=>snapshot,send,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow();pet.showInactive();await wait(500);
 api.getSnapshot().quota={health:'preview',windows:[{label:'5小时',remaining:62,resetsAt:1793000000},{label:'每周',remaining:86,resetsAt:1793300000}],updatedAt:Date.now()};
 api.getSnapshot().status={state:'idle',threads:[]};api.send();
 api.getPanel().apply({detailsVisible:true});await wait(400);
 let detail=api.getDetails().getWindow(),mutations=[],observed;
 function observe(){if(observed===detail)return;observed=detail;
 for(const method of ['setBounds','setSize','setPosition','setResizable','hide','showInactive']){
  const native=detail[method].bind(detail);detail[method]=(...args)=>{mutations.push({method,args,before:detail.getBounds()});return native(...args);};
 }
 const zoom=detail.webContents.setZoomFactor.bind(detail.webContents);
 detail.webContents.setZoomFactor=value=>{mutations.push({method:'setZoomFactor',requested:value,actual:detail.webContents.getZoomFactor()});return zoom(value);};
 }observe();
 for(const display of screen.getAllDisplays())for(const scale of [.8,1,1.2,1.4,1.6]){
  api.getPanel().apply({dock:null,size:1});pet.setPosition(display.workArea.x+30,display.workArea.y+20);
  api.getPanel().apply({dockEnabled:true,dock:'left',detailsScale:scale});await wait(500);detail=api.getDetails().getWindow();observe();
  mutations=[];const start=detail.getBounds();
  for(let i=0;i<15;i++){api.send();api.updateTaskBubble();await wait(40);}
  checks.push({name:`no-idle-native-repaint-${display.id}-${scale}`,pass:mutations.length===0&&detail.isVisible(),displayScale:display.scaleFactor,scale,mutations:mutations.slice(0,12),count:mutations.length,start,end:detail.getBounds(),zoom:detail.webContents.getZoomFactor()});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),30000);
