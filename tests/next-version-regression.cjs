// Isolated actual renderer/menu/profile tests; statuses are explicitly simulated.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out)throw Error('Use isolated output');fs.mkdirSync(out,{recursive:true});
process.argv.push('--no-bridge','--settings-self-test');const main=path.resolve(__dirname,'../src/inori/main.cjs'),electron=require('electron');
class HiddenWindow extends BrowserWindow{constructor(options){super({...options,show:false});}}
const under=new Module(main,module);under.filename=main;under.paths=Module._nodeModulePaths(path.dirname(main));const native=under.require.bind(under);
under.require=id=>id==='electron'?{...electron,BrowserWindow:HiddenWindow}:native(id);
under._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={settings,menu,send,takeMessage,getWindow:()=>win,getPanel:()=>settingsPanel};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 const api=under.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(100);const win=api.getWindow();
 const js=s=>win.webContents.executeJavaScript(s);for(let i=0;i<100;i++){if(await js('Boolean(window.inoriSmokeState?.().canvasReady)'))break;await wait(100);}
 const checks=[],record=(name,pass)=>checks.push({name,pass});
 record('right-click-bubble-toggle-exists',!!api.menu().items.find(x=>x.label==='显示任务气泡'&&x.type==='checkbox'));
 api.menu().items.find(x=>x.label==='显示任务气泡').click();await wait(350);
 const saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));
 record('right-click-toggle-saved-off',saved.bubbleEnabled===false);
 const panel=await api.getPanel().open();await wait(150);
 record('settings-checkbox-matches-right-click',await panel.webContents.executeJavaScript("document.getElementById('bubbleEnabled').checked===false"));
 await panel.webContents.executeJavaScript('window.pet.set({bubbleEnabled:true})');record('settings-toggle-updates-right-click',api.menu().items.find(x=>x.label==='显示任务气泡').checked===true);
 api.takeMessage({kind:'status',healthy:true,threads:[]});await wait(180);
 await panel.webContents.executeJavaScript('window.pet.set({reduced:true})');await wait(80);
 const before=await js('window.inoriRenderStats()');await wait(450);const after=await js('window.inoriRenderStats()');
 record('held-frame-does-not-readback-every-refresh',after.readbackCount-before.readbackCount<=1);
 await panel.webContents.executeJavaScript('window.pet.set({reduced:false})');
 await panel.webContents.executeJavaScript("window.pet.set({bubbleTone:'affectionate',bubbleCustomLine:'陪我一起完成吧♡'})");
 await wait(350);
 const config=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR,'settings.json'),'utf8'));
 record('bubble-tone-custom-persisted',config.bubbleTone==='cute'&&config.bubbleCustomLine==='陪我一起完成吧♡');
 record('phrase-browser-collapsed-and-only-two-tones',await panel.webContents.executeJavaScript("!document.getElementById('bubblePhrases').open&&document.getElementById('bubbleTone').options.length===2&&document.getElementById('bubbleTone').value==='cute'"));
 await panel.webContents.executeJavaScript("document.getElementById('bubblePhrases').open=true;document.getElementById('bubblePhraseState').value='working';document.getElementById('bubblePhraseState').dispatchEvent(new Event('change'))");
 record('phrase-browser-combined-and-custom-lines',await panel.webContents.executeJavaScript("document.getElementById('bubblePhraseList').textContent.includes('正在认真想下一步呢～')&&document.getElementById('bubblePhraseList').textContent.includes('陪我把这一步做好嘛♡')&&document.getElementById('bubblePhraseList').textContent.includes('陪我一起完成吧♡')"));
 await panel.webContents.executeJavaScript("window.pet.set({bubbleTone:'simple'})");
 record('phrase-browser-refreshes-tone-without-closing',await panel.webContents.executeJavaScript("document.getElementById('bubblePhrases').open&&document.getElementById('bubblePhraseState').value==='working'&&document.getElementById('bubblePhraseList').textContent.includes('正在处理当前任务')&&!document.getElementById('bubblePhraseList').textContent.includes('陪我把这一步做好嘛♡')"));
 await panel.webContents.executeJavaScript("window.pet.set({bubbleTone:'cute'})");
 record('invalid-tone-and-length-rejected',await panel.webContents.executeJavaScript("Promise.all([{bubbleTone:'bad'},{bubbleCustomLine:'a'.repeat(57)}].map(p=>window.pet.set(p).then(()=>false,()=>true))).then(v=>v.every(Boolean))"));
 let opened=0;const bubble=require('../src/inori/task-bubble.cjs').createTaskBubble({hidden:true,onSettings:()=>opened++});
 const anchor={x:500,y:400,width:150,height:180},snapshot={status:{state:'waiting',title:'模拟任务 · 验证地图加载',approvalPending:true,statusSource:'desktop-ipc-experimental',threads:[{}]}};
 bubble.update(snapshot,anchor,true);await wait(300);bubble.update(snapshot,anchor,true);await wait(150);
 const bubbleWin=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡');
 record('actual-bubble-shows-title-and-approval',!!bubbleWin&&await bubbleWin.webContents.executeJavaScript("document.getElementById('title').textContent.includes('验证地图加载')&&document.getElementById('label').textContent==='需要你批准'"));
 const caption=await bubbleWin.webContents.executeJavaScript("document.getElementById('headline').textContent");
 await bubbleWin.webContents.executeJavaScript("document.getElementById('headline').click();document.getElementById('more').click()");await wait(100);
 record('click-cycles-caption-and-opens-settings',opened===1&&await bubbleWin.webContents.executeJavaScript(`document.getElementById('headline').textContent!==${JSON.stringify(caption)}&&document.getElementById('label').textContent==='需要你批准'`));
 const bounds=win.getBounds();bubble.update({...snapshot,status:{state:'working',title:'模拟任务 · 第二项',phase:'正在验证'}},anchor,true);record('bubble-update-keeps-pet-position',JSON.stringify(bounds)===JSON.stringify(win.getBounds()));
 await bubbleWin.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(100);fs.writeFileSync(path.join(out,'task-bubble-preview.png'),(await bubbleWin.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
 bubble.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual-renderer-menu-and-IPC; simulated-task-data',checks,heldFrameReadbacks:after.readbackCount-before.readbackCount},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});
setTimeout(()=>app.exit(3),25000);
