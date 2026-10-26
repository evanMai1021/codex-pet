'use strict';
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,getBubble:()=>taskBubble,send,relocate,menu};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();await wait(500);
 api.getSnapshot().status={state:'idle',threads:[]};api.send();
 let calls=0;const original=pet.setBounds.bind(pet);pet.setBounds=(...args)=>{calls++;return original(...args);};
 for(const display of screen.getAllDisplays())for(const detailsScale of [1,1.4]){
  api.getPanel().apply({dock:null,size:1,bubbleEnabled:false});pet.setPosition(display.workArea.x+100,display.workArea.y+20);await wait(300);
  api.getPanel().apply({bubbleScale:detailsScale});api.getBubble().open('quota');await wait(250);pet.focus();pet.setIgnoreMouseEvents(false);
  const before=pet.getBounds();calls=0;
  const p=await pet.webContents.executeJavaScript("(()=>{const r=document.getElementById('state-dot').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
  for(let i=0;i<3;i++){pet.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});pet.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});await wait(400);}
  // A placement correction at a new DPI must not feed its rounded size back into the next correction.
  for(let i=0;i<10;i++){api.relocate(display.workArea);await wait(60);}
  const after=pet.getBounds(),zoom=pet.webContents.getZoomFactor();
  checks.push({name:'stable-after-status-dot-and-placement-'+display.scaleFactor+'-'+detailsScale,pass:Math.abs(after.width-300)<=3&&Math.abs(after.height-560)<=3&&zoom===1,before,after,calls,zoom,renderer:await pet.webContents.executeJavaScript('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,transform:scene.style.transform,reacting:overlayUntil>0})')});
  api.getPanel().apply({size:1});await wait(600);const reset=pet.getBounds();
  checks.push({name:'size-reset-stays-reset-'+display.scaleFactor+'-'+detailsScale,pass:Math.abs(reset.width-300)<=3&&Math.abs(reset.height-560)<=3,reset});
 }
 // Reproduce the already-observed Windows +2 DIP return at the real placement call site.
 // Keep the injection bounded so a broken build cannot grow a window without limit.
 api.getPanel().apply({bubbleEnabled:false,dock:null,size:1});await wait(250);
 let injected=0;pet.setBounds=b=>{if(++injected<=10)return original({...b,width:b.width+2,height:b.height+2});return original(b);};
 const base=pet.getBounds();
 for(let i=0;i<10;i++){api.relocate();await wait(40);}
 const drifted=pet.getBounds();
 checks.push({name:'mixed-dpi-rounding-is-not-fed-back-into-size',pass:injected===0&&Math.abs(drifted.width-base.width)<=3&&Math.abs(drifted.height-base.height)<=3,base,drifted,injected,mode:'fault injection of observed Windows 2 DIP adjustment'});
 pet.setBounds=original;
 api.getPanel().apply({size:1});await wait(200);
 pet.setResizable(true);pet.setSize(600,1120);pet.setResizable(false);await wait(500);
 const recovered=pet.getBounds();
 checks.push({name:'unexpected-native-enlargement-is-recovered',pass:Math.abs(recovered.width-300)<=8&&Math.abs(recovered.height-560)<=8,recovered});
 const visual=await pet.webContents.executeJavaScript('({avatarWidth:avatar.getBoundingClientRect().width,chipHeight:chip.getBoundingClientRect().height})');
 checks.push({name:'pet-and-ui-return-to-configured-scale',pass:visual.avatarWidth<=198&&visual.chipHeight<=32,visual});
 api.getPanel().apply({size:1.2});await wait(150);api.menu().items.find(i=>i.label==='恢复正常大小').click();await wait(250);
 const menuReset=pet.getBounds();checks.push({name:'explicit-size-reset-menu',pass:Math.abs(menuReset.width-300)<=8&&Math.abs(menuReset.height-560)<=8,menuReset});
 for(const size of [.8,1.2]){
  api.getPanel().apply({size});await wait(100);pet.setResizable(true);pet.setSize(600,1120);pet.setResizable(false);await wait(300);
  const b=pet.getBounds();checks.push({name:'recovery-preserves-preferred-size-'+size,pass:Math.abs(b.width-300*size)<=8&&Math.abs(b.height-560*size)<=8,bounds:b});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),25000);
