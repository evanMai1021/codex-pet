'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getDetails:()=>detailsWindow,getSnapshot:()=>snapshot,getAnchor:petPanelAnchor,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data)=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);
 const pet=api.getWindow();pet.showInactive();for(let i=0;i<100&&!api.getAnchor();i++)await wait(80);await wait(150);const petBounds=pet.getBounds(),petZoom=pet.webContents.getZoomFactor();
 api.getSnapshot().dailyUsage={health:'ready',date:'2026-10-23',inputTokens:12000000,outputTokens:345678,cachedInputTokens:10000000,totalTokens:12345678};
 api.getSnapshot().quota={health:'preview',windows:[{label:'5小时',remaining:62,resetsAt:1792800000}],updatedAt:Date.now()};api.send();
 api.getPanel().apply({detailsVisible:true});
 let detail;for(let i=0;i<80;i++){detail=api.getDetails().getWindow();if(detail&&!detail.webContents.isLoading())break;await wait(80);}await wait(150);
 const js=s=>detail.webContents.executeJavaScript(s);
 record('separate-details-window',detail.id!==pet.id&&api.getDetails().isVisible());
 record('no-local-record-text',await js("!document.body.textContent.includes('本机记录')"));
 record('full-and-million-total',await js("document.getElementById('token-total').textContent==='12,345,678'&&document.getElementById('token-million').textContent.includes('12.35 M')"));
 record('breakdown-has-millions',await js("document.querySelectorAll('#token-breakdown small').length===3&&document.querySelector('#token-breakdown').textContent.includes('12 M')"));
 record('readable-token-fonts',await js("parseFloat(getComputedStyle(document.getElementById('token-total')).fontSize)>=24&&parseFloat(getComputedStyle(document.querySelector('.token-row')).fontSize)>=14"));
 for(const scale of [.8,1,1.2,1.4,1.6]){
  api.getPanel().apply({detailsScale:scale});await wait(80);
  record('details-width-'+scale,detail.getBounds().width===Math.round(320*scale),{actual:detail.getBounds(),expectedWidth:Math.round(320*scale)});
  record('pet-geometry-independent-'+scale,JSON.stringify(pet.getBounds())===JSON.stringify(petBounds));
  record('pet-zoom-independent-'+scale,pet.webContents.getZoomFactor()===petZoom);
  record('bubble-scale-independent-'+scale,api.getPanel().get().settings.bubbleScale===1);
 }
 api.getPanel().apply({detailsScale:1.4});await wait(80);await detail.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(80);fs.writeFileSync(path.join(out,'details-140.png'),(await detail.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 api.getPanel().apply({size:.8});record('pet-size-does-not-change-details',detail.getBounds().width===448);
 await js("document.getElementById('close').click()");await wait(80);record('close-updates-settings',api.getPanel().get().settings.detailsVisible===false);
 await pet.webContents.executeJavaScript("document.getElementById('chip').click()");await wait(100);record('badge-reopens-details',api.getDetails().isVisible());
 await wait(350);const saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));record('scale-persisted',saved.detailsScale===1.4);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual separate detail window and native IPC; synthetic quota/usage',checks},null,2));app.quit();
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.quit();});setTimeout(()=>app.exit(3),25000);
