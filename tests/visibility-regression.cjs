'use strict';
const {app}=require('electron'),fs=require('fs'),path=require('path'),Module=require('module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,send};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass)=>checks.push({name,pass});
app.whenReady().then(async()=>{const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(30);await wait(350);const w=api.getWindow(),panel=api.getPanel();
 record('background-settings-instance-stays-hidden',!w.isVisible());
 app.emit('second-instance',{},[process.execPath,'--codex-autostart']);await wait(180);record('autostart-adopts-background-instance',w.isVisible());
 panel.apply({visible:false});await wait(80);app.emit('second-instance',{},[process.execPath,'--codex-autostart']);await wait(180);record('plugin-reconnect-preserves-manual-hide',!w.isVisible());
 for(let i=0;i<4;i++){panel.apply({visible:true});await wait(60);record('explicit-show-'+i,w.isVisible());const t=Date.now();panel.apply({visible:false});record('immediate-hide-'+i,!w.isVisible()&&Date.now()-t<500);api.send();await wait(120);record('snapshot-does-not-undo-hide-'+i,!w.isVisible());}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),checks},null,2));app.quit();
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.quit();});setTimeout(()=>app.quit(),15000).unref();
