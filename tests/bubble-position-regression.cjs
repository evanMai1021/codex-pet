'use strict';
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);
under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getPanel:()=>settingsPanel,getWindow:()=>win};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass)=>checks.push({name,pass});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const panel=api.getPanel(),native=await panel.open(),js=s=>native.webContents.executeJavaScript(s);
 for(let i=0;i<50;i++){if(await js("document.getElementById('bubblePosition').value==='auto'"))break;await wait(100);}
 const change=async(id,value)=>{await js(`{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));}`);await wait(200);};
 await change('bubblePosition','left');await change('bubbleOffsetX',-30);await change('bubbleOffsetY',25);
 record('native-controls-roundtrip',panel.get().settings.bubblePosition==='left'&&panel.get().settings.bubbleOffsetX===-30&&panel.get().settings.bubbleOffsetY===25);
 const petBefore=api.getWindow().getBounds(),area=screen.getPrimaryDisplay().workArea;
 const anchor={x:Math.round(area.x+area.width/2-60),y:Math.round(area.y+area.height/2-70),width:120,height:140};
 const bubble=require(path.join(path.dirname(main),'task-bubble.cjs')).createTaskBubble({hidden:true}),snapshot={status:{state:'working',title:'模拟位置验证',threads:[{}]}};
 const {placeBubble}=require('../src/inori/bubble-model.cjs');
 for(const scale of [.8,1,1.2,1.4])for(const side of ['auto','left','right','top','bottom']){
  const options={bubblePosition:side,bubbleOffsetX:side==='left'?-30:30,bubbleOffsetY:side==='top'?-25:25,bubbleScale:scale};
  const actualScale=Math.min(scale,area.width/300,area.height/328),expected=placeBubble(anchor,area,Math.round(300*actualScale),Math.round(328*actualScale),[],options);
  bubble.update(snapshot,anchor,true,options);await wait(50);const w=bubble.getWindow();
  record('native-geometry-'+scale+'-'+side,!!expected&&JSON.stringify(w.getBounds())===JSON.stringify(expected));
 }
 for(const page of ['task','quota','usage']){bubble.open(page);bubble.update(snapshot,anchor,true,{bubblePosition:'left',bubbleOffsetX:-30,bubbleOffsetY:25});await wait(100);const b=bubble.getWindow().getBounds();record('page-position-'+page,JSON.stringify(b)===JSON.stringify(placeBubble(anchor,area,300,328,[],{bubblePosition:'left',bubbleOffsetX:-30,bubbleOffsetY:25})));}
 record('pet-geometry-preserved',JSON.stringify(api.getWindow().getBounds())===JSON.stringify(petBefore));
 await wait(350);const saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));
 record('position-persisted',saved.bubblePosition==='left'&&saved.bubbleOffsetX===-30&&saved.bubbleOffsetY===25);
 await js("document.getElementById('resetBubblePosition').click()");await wait(250);
 record('native-reset-ui',await js("document.getElementById('bubblePosition').value==='auto'&&Number(document.getElementById('bubbleOffsetX').value)===0&&Number(document.getElementById('bubbleOffsetY').value)===0"));
 record('native-reset',panel.get().settings.bubblePosition==='auto'&&panel.get().settings.bubbleOffsetX===0&&panel.get().settings.bubbleOffsetY===0);
 await js("document.getElementById('bubblePosition').scrollIntoView({block:'center'})");await wait(100);
 await native.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(100);
 fs.writeFileSync(path.join(out,'position-settings.png'),(await native.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 const report={passed:checks.every(c=>c.pass),mode:'isolated-real-native-settings-and-bubble; simulated-task',checks};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));bubble.close();app.exit(report.passed?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});
setTimeout(()=>app.exit(3),25000);
