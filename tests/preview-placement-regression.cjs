'use strict';
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs');
const m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={panel:()=>settingsPanel,win:()=>win,regions:()=>regions,relocate};',main);
const api=m.exports,wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const record=(name,pass,detail)=>checks.push({name,pass,detail});
app.whenReady().then(async()=>{
 for(let i=0;i<100&&!api.panel();i++)await wait(50);
 const w=api.win();
 async function settle(){await wait(350);await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}).catch(()=>{});await wait(150);}
 await settle();for(let i=0;i<80&&!api.regions().length;i++){await settle();}
 api.panel().apply({reduced:true,size:1,dock:null,quotaBadgeVisible:true});await settle();
 const area=screen.getDisplayMatching(w.getBounds()).workArea;
 w.setPosition(area.x+area.width-300,area.y+area.height-420);api.relocate();await settle();
 const before={bounds:w.getBounds(),regions:api.regions()};
 api.panel().apply({quotaBadgeVisible:false});await settle();
 const after={bounds:w.getBounds(),regions:api.regions()};
 record('hidden-badge-is-not-rendered',await w.webContents.executeJavaScript("document.getElementById('chip').hidden&&getComputedStyle(document.getElementById('chip')).display==='none'"));
 record('hidden-badge-has-no-hit-region',!after.regions.some(r=>r.kind==='chip'));
 const bottom=(v)=>v.bounds.y+Math.max(...v.regions.map(r=>r.y+r.height));
 record('hide-badge-reanchors-free-pet-to-bottom',Math.abs(bottom(before)-(area.y+area.height))<4&&Math.abs(bottom(after)-(area.y+area.height))<4,{before,after,area});
 api.panel().apply({quotaBadgeVisible:true});await settle();
 record('show-badge-restores-placement-without-drift',Math.abs(w.getBounds().y-before.bounds.y)<4);
 const middle={x:area.x+100,y:area.y+Math.max(0,area.height/2-420)};w.setPosition(middle.x,Math.round(middle.y));await settle();
 const mid=w.getBounds();api.panel().apply({quotaBadgeVisible:false});await settle();record('free-middle-position-preserved',Math.abs(w.getBounds().y-mid.y)<3);
 for(const size of [.8,1,1.2])for(const dock of ['left','right','top','bottom']){
  api.panel().apply({size,dock,quotaBadgeVisible:true});await settle();const start=w.getBounds();
  api.panel().apply({quotaBadgeVisible:false});await settle();api.panel().apply({quotaBadgeVisible:true});await settle();
  const end=w.getBounds();record(`dock-${dock}-size-${size}-toggle-keeps-anchor-and-size`,Math.abs(end.x-start.x)<4&&Math.abs(end.y-start.y)<4&&Math.abs(end.width-Math.round(300*size))<=2&&Math.abs(end.height-Math.round(560*size))<=2);
 }
 const panel=await api.panel().open(),js=s=>panel.webContents.executeJavaScript(s);
 await panel.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(350);
 await js(`document.querySelector('[data-preview-skin="battle"]').click()`);await wait(350);
 record('native-preview-click-saves-outfit',api.panel().get().settings.skin==='battle');
 await js(`document.querySelector('[data-preview-style="style1"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await wait(350);
 record('native-preview-keyboard-saves-style',api.panel().get().settings.quotaStyle==='style1');
 record('native-dropdowns-hidden',await js(`['skin','quotaStyle'].every(id=>document.getElementById(id).getBoundingClientRect().height===0)`));
 record('native-preview-accessible-selection',await js(`document.querySelector('[data-preview-skin="battle"]').getAttribute('aria-checked')==='true'`));
 await js(`document.querySelector('.skin-previews').scrollIntoView({block:'center'})`);await wait(100);fs.writeFileSync(path.join(out,'native-cards.png'),(await panel.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});
setTimeout(()=>app.exit(3),60000);
