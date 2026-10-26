'use strict';
// Actual native windows and renderer. No bridge, account data or live settings.
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,getRegions:()=>regions,send,relocate,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data)=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow(),js=s=>pet.webContents.executeJavaScript(s);pet.showInactive();await wait(700);
 const displays=screen.getAllDisplays().map(d=>({id:d.id,scaleFactor:d.scaleFactor,bounds:d.bounds,workArea:d.workArea}));
 api.getSnapshot().quota={health:'preview',windows:[{label:'5小时',remaining:62,resetsAt:1793000000},{label:'每周',remaining:86,resetsAt:1793300000}],updatedAt:Date.now()};
 api.getSnapshot().dailyUsage={health:'ready',date:'2026-10-26',totalTokens:123456789,inputTokens:120000000,outputTokens:3456789,cachedInputTokens:100000000};
 api.getSnapshot().status={state:'idle',threads:[]};api.send();
 for(const display of displays)for(const size of [.8,1,1.2])for(const dock of [null,'left','right','top','bottom']){
  api.getPanel().apply({dockEnabled:true,dock:null,size,reduced:false,bubbleEnabled:false});
  const a=display.workArea;pet.setPosition(a.x+Math.round(a.width/2-150*size),a.y+30);
  api.getPanel().apply({dock});await wait(280);api.relocate(a);await wait(100);
  const measured=await js("(()=>{const r=chip.getBoundingClientRect(),a=avatar.getBoundingClientRect();return {chip:{x:r.x,y:r.y,width:r.width,height:r.height},bodyBottom:a.top+(ink.y+ink.height)*a.height/208,viewport:{width:innerWidth,height:innerHeight}}})()");
  const b=pet.getBounds(),c=measured.chip,tolerance=2;
  record(`badge-complete-${display.id}-${size}-${dock}`,c.x>=-tolerance&&c.y>=-tolerance&&c.x+c.width<=measured.viewport.width+tolerance&&c.y+c.height<=measured.viewport.height+tolerance,{measured});
  record(`badge-on-monitor-${display.id}-${size}-${dock}`,b.x+c.x>=a.x-tolerance&&b.y+c.y>=a.y-tolerance&&b.x+c.x+c.width<=a.x+a.width+tolerance&&b.y+c.y+c.height<=a.y+a.height+tolerance,{bounds:b,chip:c,area:a});
  if(dock===null)record(`badge-below-feet-${display.id}-${size}`,c.y-measured.bodyBottom>=3,{gap:c.y-measured.bodyBottom});
 }
 // Force the full badge beyond each monitor edge, then exercise the production clamp.
 for(const display of displays)for(const size of [.8,1,1.2])for(const edge of ['left','right','top','bottom']){
  api.getPanel().apply({dock:null,size,dockEnabled:false});const a=display.workArea;
  const x=edge==='left'?a.x-130:edge==='right'?a.x+a.width-70:a.x+200;
  const y=edge==='top'?a.y-380:edge==='bottom'?a.y+a.height-50:a.y+20;
  pet.setPosition(x,y);await wait(120);api.relocate(a);await wait(180);
  const b=pet.getBounds(),r=await js("(()=>{const r=chip.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()");
  record(`free-edge-badge-${display.id}-${size}-${edge}`,b.x+r.x>=a.x-2&&b.y+r.y>=a.y-2&&b.x+r.x+r.width<=a.x+a.width+2&&b.y+r.y+r.height<=a.y+a.height+2,{bounds:b,chip:r,area:a});
 }
 checks.push({name:'independent-details-window-removed',pass:!require('electron').BrowserWindow.getAllWindows().some(w=>w.getTitle().includes('额度详情'))});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),displays,checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),60000);