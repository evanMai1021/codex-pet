'use strict';
// Real windows, synthetic status, isolated settings; no account or bridge.
const e=require('electron'),{app,screen,ipcMain}=e,fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');let cursor={x:0,y:0};
const proxy=new Proxy(screen,{get(t,k){if(k==='getCursorScreenPoint')return()=>cursor;const v=t[k];return typeof v==='function'?v.bind(t):v;}});
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));const req=m.require.bind(m);m.require=n=>n==='electron'?{...e,screen:proxy}:req(n);
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getSnapshot:()=>snapshot,send,relocate};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();
 const errors=[];pet.webContents.on('console-message',(_event,level,message)=>{if(level>=2)errors.push(message);});
 for(let i=0;i<150&&!(await pet.webContents.executeJavaScript('window.inoriSmokeState().canvasReady'));i++)await wait(50);
 await wait(400);
 api.getSnapshot().status={state:'idle',threads:[]};api.getSnapshot().quota={health:'preview',windows:[{label:'5小时',remaining:35},{label:'每周',remaining:90}]};api.send();
 const displays=screen.getAllDisplays();
 for(const display of displays)for(const dock of ['bottom','left','right','top']){
  const a=display.workArea;api.getPanel().apply({dock:null,size:1,reduced:false,bubbleEnabled:false});pet.setPosition(a.x+Math.round(a.width/2-150),a.y+30);await wait(120);api.getPanel().apply({dock});api.relocate(a);await wait(500);
  const measured=await pet.webContents.executeJavaScript(`(()=>{let paintError=null;try{paint()}catch(e){paintError=e.stack}const c=chip.getBoundingClientRect(),r=avatar.getBoundingClientRect();return{paintError,classes:scene.className,chip:{x:c.x,y:c.y,width:c.width,height:c.height},ink:{x:r.x+ink.x*r.width/192,y:r.y+ink.y*r.height/208,width:ink.width*r.width/192,height:ink.height*r.height/208},viewport:{width:innerWidth,height:innerHeight}}})()`);
  checks.push({name:'renderer-completes-'+display.id+'-'+dock,pass:!measured.paintError,error:measured.paintError});
  const b=pet.getBounds(),p=measured.ink,c=measured.chip;
  const collision=c.x<p.x+p.width&&c.x+c.width>p.x&&c.y<p.y+p.height&&c.y+c.height>p.y;
  checks.push({name:`badge-clear-${display.id}-${dock}`,pass:!collision,measured});
  const gap=dock==='left'?b.x+p.x-a.x:dock==='right'?a.x+a.width-b.x-p.x-p.width:dock==='top'?b.y+p.y-a.y:a.y+a.height-b.y-p.y-p.height;
  checks.push({name:`ink-at-edge-${display.id}-${dock}`,pass:Math.abs(gap)<=8,gap,bounds:b,area:a});
  let moves=0,resizes=0;const trace=[],moved=()=>{moves++;trace.push({event:'move',bounds:pet.getBounds()});},resized=()=>{resizes++;trace.push({event:'resize',bounds:pet.getBounds()});};pet.on('move',moved);pet.on('resize',resized);await wait(700);pet.off('move',moved);pet.off('resize',resized);
  checks.push({name:`resting-window-stable-${display.id}-${dock}`,pass:moves===0&&resizes===0,moves,resizes,trace});
  if(dock==='bottom')await pet.webContents.capturePage().then(im=>fs.writeFileSync(path.join(out,`bottom-${display.id}.png`),im.toPNG()));
  await pet.webContents.executeJavaScript('activeClick="wave";clickStartedAt=Date.now();overlayUntil=Date.now()+1200;paint()');await wait(80);
  const peek=await pet.webContents.executeJavaScript(`(()=>{const c=chip.getBoundingClientRect(),r=avatar.getBoundingClientRect();return{chip:{x:c.x,y:c.y,width:c.width,height:c.height},pet:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`);
  const pc=peek.chip,pp=peek.pet;
  checks.push({name:`reaction-badge-clear-${display.id}-${dock}`,pass:!(pc.x<pp.x+pp.width&&pc.x+pc.width>pp.x&&pc.y<pp.y+pp.height&&pc.y+pc.height>pp.y),peek});
  if(dock==='bottom')await pet.webContents.capturePage().then(im=>fs.writeFileSync(path.join(out,`peek-${display.id}.png`),im.toPNG()));
  await pet.webContents.executeJavaScript('overlayUntil=0;paint()');
 }
 for(const display of displays){
  const a=display.workArea;api.getPanel().apply({dock:null,bubbleEnabled:false});pet.setPosition(a.x+200,a.y+20);await wait(300);
  const b=pet.getBounds();cursor={x:b.x+150,y:b.y+400};ipcMain.emit('inori:press',{});const start={...cursor},samples=[];
  for(let i=1;i<=60;i++){cursor={x:start.x+i,y:start.y+(i%12)};ipcMain.emit('inori:drag',{});samples.push(pet.getBounds());await wait(10);}
  ipcMain.emit('inori:release',{});await wait(600);
  checks.push({name:'drag-native-size-stable-'+display.id,pass:samples.every(r=>Math.abs(r.width-300)<=8&&Math.abs(r.height-560)<=8),samples});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),errors:errors.slice(0,8),displays:displays.map(d=>({id:d.id,scaleFactor:d.scaleFactor,workArea:d.workArea})),checks},null,2));app.quit();
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);app.exit(2);});setTimeout(()=>app.exit(3),25000);
