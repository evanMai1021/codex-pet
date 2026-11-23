'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR||!process.env.CODEX_PET_HOME)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN,m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={win:()=>win,panel:()=>settingsPanel,snapshot:()=>snapshot,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));const checks=[],samples=[];
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.panel();i++)await wait(30);
 const w=api.win(),js=s=>w.webContents.executeJavaScript(s);
 api.panel().apply({quotaBadgeVisible:false,dock:null,size:1,reduced:false,visible:true});
 for(let i=0;i<120;i++){await wait(30);if(await js('skinReady&&paintCount>0'))break;}
 await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
 let shows=0,hides=0;w.on('show',()=>shows++);w.on('hide',()=>hides++);
 for(let i=0;i<6;i++){api.panel().apply({visible:true});await wait(30);}
 checks.push({name:'redundant-show-keeps-existing-native-presentation',pass:shows===0,shows,hides});
 const states=['unknown','idle','working','waiting','working','completed','error','interrupted','idle'];
 for(const skin of ['redwhite','battle']){
  api.panel().apply({skin});await wait(250);
  for(let round=0;round<2;round++)for(const state of states){
   const snap=api.snapshot();snap.status={state,threads:[],turnId:'continuity-'+round};snap.lastInteraction=Date.now();api.send();
   for(let i=0;i<3;i++){
    await wait(45);const value=await js("(()=>{paint();let ink=0;const data=ctx.getImageData(0,0,192,208).data;for(let p=3;p<data.length;p+=4)if(data[p]>80)ink++;const r=avatar.getBoundingClientRect();return {ink,canvasOpacity:getComputedStyle(document.getElementById('sprite')).opacity,videoReady:videoAnimation.video?.readyState??null,rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}}})()");
    const shot=await w.webContents.capturePage(value.rect,{stayHidden:true,stayAwake:true});const bytes=shot.getBitmap();let visiblePixels=0;for(let p=3;p<bytes.length;p+=4)if(bytes[p]>80)visiblePixels++;
    const sample={skin,state,round,index:i,ink:value.ink,visiblePixels,canvasOpacity:value.canvasOpacity,videoReady:value.videoReady};samples.push(sample);
    if(visiblePixels<100)fs.writeFileSync(path.join(out,'blank-'+samples.length+'.png'),shot.toPNG());
   }
  }
 }
 const blank=samples.filter(s=>s.visiblePixels<100);
 checks.push({name:'state-and-skin-transitions-keep-visible-character',pass:blank.length===0,samples:samples.length,blankSamples:blank.length});
 const lifecycle=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'desktop-lifecycle.json'),'utf8'));
 const health=lifecycle.renderHealth;
 checks.push({name:'bounded-render-health-snapshot-is-valid',pass:!!health&&health.emptyFrameCount===0&&health.rendererErrorCount===0&&health.windowVisible===true&&health.alwaysOnTop===true&&JSON.stringify(lifecycle).length<16384,health});
 const result={passed:checks.every(c=>c.pass),checks,blankSamples:blank,samples};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));app.exit(result.passed?0:1);
}).catch(error=>{fs.writeFileSync(path.join(out,'error.txt'),error.stack);app.exit(2);});
setTimeout(()=>app.exit(3),40000);
