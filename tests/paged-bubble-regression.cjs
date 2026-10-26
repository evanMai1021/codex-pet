'use strict';
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});process.argv.push('--no-bridge','--control-only');
const main=process.env.INORI_TEST_MAIN||path.resolve(__dirname,'../src/inori/main.cjs'),m=new Module(main,module);m.filename=main;m.paths=Module._nodeModulePaths(path.dirname(main));
m._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={getWindow:()=>win,getPanel:()=>settingsPanel,getBubble:()=>taskBubble,getSnapshot:()=>snapshot,send,updateTaskBubble};',main);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,data)=>checks.push({name,pass,...data});
app.whenReady().then(async()=>{
 const api=m.exports;for(let i=0;i<100&&!api.getPanel();i++)await wait(80);const pet=api.getWindow();pet.showInactive();const a=screen.getPrimaryDisplay().workArea;pet.setPosition(a.x+400,a.y+20);
 api.getPanel().apply({dock:null,size:1,bubbleEnabled:true,bubbleScale:1});
 const snap=api.getSnapshot();snap.status={state:'working',title:'模拟任务 · 合并翻页气泡',phase:'核对页面',threadId:'a',turnId:'turn-a',threads:[{}]};
 snap.threadUsage={health:'ready',threads:[{threadId:'a',title:'聊天 A',totalTokens:12345678,health:'ready'},{threadId:'b',title:'聊天 B',totalTokens:87654321,health:'ready'}]};
 snap.dailyUsage={health:'ready',date:'2026-10-26',totalTokens:123456789,inputTokens:120000000,outputTokens:3456789,cachedInputTokens:90000000};
 snap.quota={health:'preview',windows:[{label:'5小时',remaining:62,resetsAt:1793000000},{label:'每周',remaining:86,resetsAt:1793300000}]};api.send();
 for(let i=0;i<80;i++){await wait(50);const w=api.getBubble().getWindow();if(w?.isVisible()&&!w.webContents.isLoading())break;}
 let bubble=api.getBubble().getWindow();if(!bubble)throw Error('No merged bubble');const js=s=>bubble.webContents.executeJavaScript(s);
 record('no-independent-details-window',!BrowserWindow.getAllWindows().some(w=>w.getTitle().includes('额度详情')));
 record('old-details-settings-removed',!('detailsScale' in api.getPanel().get().settings)&&!('detailsVisible' in api.getPanel().get().settings));
 record('old-details-markup-removed',await pet.webContents.executeJavaScript("!document.getElementById('panel')"));
 record('task-first-page-keeps-content',await js("!document.getElementById('page-task').hidden&&document.getElementById('title').textContent.includes('合并翻页')"));
 record('current-conversation-cumulative',await js("document.getElementById('chat-total').textContent==='12,345,678'&&document.getElementById('chat-million').textContent.includes('12.35 M')"));
 await js("document.getElementById('thread').value='b';document.getElementById('thread').dispatchEvent(new Event('change'))");await wait(100);
 record('selected-conversation-is-independent',await js("document.getElementById('chat-total').textContent==='87,654,321'&&document.getElementById('title').textContent.includes('合并翻页')"));
 fs.writeFileSync(path.join(out,'task.png'),(await bubble.webContents.capturePage()).toPNG());const bounds=bubble.getBounds();
 for(const page of ['quota','usage','task']){
  await js(`document.querySelector('[data-page="${page}"]').click()`);await wait(100);
  record('page-'+page,await js(`!document.getElementById('page-${page}').hidden`));record('native-size-stable-'+page,JSON.stringify(bounds)===JSON.stringify(bubble.getBounds()));
  if(page!=='task')fs.writeFileSync(path.join(out,page+'.png'),(await bubble.webContents.capturePage()).toPNG());
 }
 record('quota-fields-retained',await js("document.getElementById('quota-windows').textContent.includes('62%')&&document.getElementById('quota-windows').textContent.includes('86%')"));
 record('today-exact-and-millions',await js("document.getElementById('today-total').textContent==='123,456,789'&&document.getElementById('today-million').textContent.includes('123.46 M')"));
 record('millions-lead-exact-counts',await js("['chat','today'].every(id=>{const m=document.getElementById(id+'-million'),n=document.getElementById(id+'-total');return m.nextElementSibling===n&&m.classList.contains('number')&&n.classList.contains('muted')})&&Array.from(document.querySelectorAll('.token-row strong')).every(n=>n.firstChild.textContent.includes(' M')&&n.querySelector('small').textContent.match(/^[0-9,]+$/))"));
 record('daily-breakdown-retained',await js("document.querySelectorAll('.token-row').length===3&&document.getElementById('breakdown').textContent.includes('90,000,000')"));
 await js("document.querySelector('[data-page="+'"usage"'+"]').click()");await wait(80);
 const beforeId=bubble.id,other=screen.getAllDisplays().find(d=>d.id!==screen.getPrimaryDisplay().id);
 if(other){pet.setPosition(other.workArea.x+350,other.workArea.y+20);await wait(1000);bubble=api.getBubble().getWindow();record('cross-screen-fresh-window',bubble.id!==beforeId);record('page-and-selection-survive-cross-screen',await js("!document.getElementById('page-usage').hidden&&document.getElementById('thread').value==='b'"));}
 snap.status={state:'idle',threads:[]};api.send();await wait(100);record('usage-remains-browsable-when-idle',bubble.isVisible());
 api.getPanel().apply({bubbleEnabled:false});await wait(100);record('disable-auto-hides-bubble',!bubble.isVisible());
 await pet.webContents.executeJavaScript("document.getElementById('chip').click()");await wait(400);bubble=api.getBubble().getWindow();record('badge-opens-quota-with-auto-disabled',bubble.isVisible()&&await js("!document.getElementById('page-quota').hidden"));
 snap.threadUsage={health:'unavailable',threads:[]};api.send();await wait(150);record('unknown-thread-usage-is-not-zero',await js("document.getElementById('chat-million').textContent==='暂不可用'&&document.getElementById('chat-total').textContent===''"));
 api.getPanel().apply({bubbleScale:1.4});await wait(150);record('all-pages-scale-independently',Math.abs(bubble.getBounds().width-420)<=8&&pet.getBounds().width<=308);
 await js("document.getElementById('dismiss').click()");await wait(150);record('close-remains-closed',!bubble.isVisible());
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual native windows; synthetic quota and per-chat usage',checks},null,2));app.exit(checks.every(c=>c.pass)?0:1);
}).catch(err=>{fs.writeFileSync(path.join(out,'error.txt'),err.stack);app.exit(2);});setTimeout(()=>app.exit(3),30000);
