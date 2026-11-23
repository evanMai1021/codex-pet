'use strict';
const {app,screen}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.disableHardwareAcceleration(); // Deterministic CSS screenshots despite a failing shared GPU context.
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(process.env.INORI_DATA_DIR,{recursive:true});app.setPath('userData',process.env.INORI_DATA_DIR);
const source=process.env.INORI_TEST_MAIN?path.dirname(process.env.INORI_TEST_MAIN):path.resolve(__dirname,'../src/inori');
const {createTaskBubble}=require(path.join(source,'task-bubble.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],record=(name,pass,details)=>checks.push({name,pass,details});
app.whenReady().then(async()=>{
 const bubble=createTaskBubble({hidden:true}),a=screen.getPrimaryDisplay().workArea,anchor={x:a.x+Math.round(a.width/2),y:a.y+Math.round(a.height/2),width:100,height:120};
 const snapshot={status:{state:'working',statusSource:'local-lifecycle',threadId:'a',turnId:'t',title:'整理项目发布清单',phase:'正在检查文件和版本',publicProgress:'把更新内容逐项核对好，再一起完成发布。',threads:[{threadId:'a',state:'working'},{threadId:'b',state:'unknown'}]},threadUsage:{health:'ready',threads:[{threadId:'a',title:'当前任务聊天',totalTokens:82400,health:'ready'},{threadId:'b',title:'项目说明',totalTokens:126800,health:'ready'}]},dailyUsage:{health:'ready',date:'2026-11-24',totalTokens:428600,inputTokens:380000,outputTokens:48600,cachedInputTokens:210000},quota:{health:'preview',windows:[{label:'5小时',remaining:67,resetsAt:1795532400},{label:'每周',remaining:82,resetsAt:1795791600}]}};
 const options={bubbleScale:1,quotaStyle:'style1'};
 bubble.update(snapshot,anchor,true,options);let win=bubble.getWindow();const js=s=>win.webContents.executeJavaScript(s);
 for(let i=0;i<60;i++){await wait(50);bubble.update(snapshot,anchor,true,options);if(await js("document.getElementById('title').textContent==='整理项目发布清单'"))break;}
 const capture=async(name)=>{const wasVisible=win.isVisible();win.showInactive();try{let shot,composed=false;for(let i=0;i<8;i++){await wait(100);shot=await win.webContents.capturePage();const bits=shot.toBitmap(),size=shot.getSize();let opaque=0;for(let j=3;j<bits.length;j+=4)if(bits[j]>100)opaque++;if(opaque>size.width*size.height*.45){composed=true;break;}}if(!composed)throw Error('Cloud background not composed for '+name);record('cloud-composed-'+name,true);fs.writeFileSync(path.join(out,name+'.png'),shot.toPNG());}finally{if(!wasVisible)win.hide();}};
 const contentsInside=()=>js(`(()=>{
  const svg=document.querySelector('.thought-outline'),path=svg.querySelector('path'),matrix=svg.getScreenCTM().inverse(),viewport=document.querySelector('.pages').getBoundingClientRect(),outside=[];
  for(const el of document.querySelectorAll('button,select,h1,p,small,#stage,.number,.muted,.quota-row,.quota-summary-card')){
   if(!el.getClientRects().length)continue;
   const r=el.getBoundingClientRect();let left=r.left,top=r.top,right=r.right,bottom=r.bottom;
   if(el.closest('.pages')){left=Math.max(left,viewport.left);top=Math.max(top,viewport.top);right=Math.min(right,viewport.right);bottom=Math.min(bottom,viewport.bottom);}
   if(right-left<3||bottom-top<3)continue;
   const points=[[left+1.5,top+1.5],[right-1.5,top+1.5],[right-1.5,bottom-1.5],[left+1.5,bottom-1.5],[(left+right)/2,(top+bottom)/2]];
   if(!points.every(([x,y])=>path.isPointInFill(new DOMPoint(x,y).matrixTransform(matrix))))outside.push(el.id||el.className||el.tagName);
  }
  return {pass:outside.length===0,outside};
 })()`);
 record('local-source-visible',await js("document.getElementById('stage').textContent.includes('本地状态')"));
 record('thought-cloud-and-two-dots',await js("!!document.querySelector('.thought-outline path')&&document.querySelectorAll('.thought-tail i').length===2"));
 record('usage-hidden-by-default-with-no-layout-space',await js("document.getElementById('chat-usage-details').hidden&&document.getElementById('chat-usage-details').getBoundingClientRect().height===0&&document.getElementById('chat-usage-toggle').getAttribute('aria-expanded')==='false'"));
 record('collapsed-button-is-small-and-at-bottom-right',await js("(()=>{const b=document.getElementById('chat-usage-toggle').getBoundingClientRect(),p=document.querySelector('.pages').getBoundingClientRect();return b.width<110&&b.left+b.width/2>p.left+p.width/2&&b.top>p.top+p.height/2})()"));
 record('readable-task-type-scale',await js("parseFloat(getComputedStyle(document.getElementById('title')).fontSize)===15&&parseFloat(getComputedStyle(document.getElementById('progress')).fontSize)===13"));
 record('session-usage-name-and-readable-button',await js("document.getElementById('chat-usage-toggle-label').textContent==='会话用量'&&parseFloat(getComputedStyle(document.getElementById('chat-usage-toggle')).fontSize)>=13&&Number(getComputedStyle(document.getElementById('chat-usage-toggle')).fontWeight)>=600"));
 await js("window.usageActionY=document.getElementById('chat-usage-toggle').getBoundingClientRect().top");
 await capture('task-collapsed');
 await js("document.getElementById('chat-usage-toggle').click()");await wait(80);
 record('explicit-click-expands-usage',await js("!document.getElementById('chat-usage-details').hidden&&document.getElementById('chat-usage-toggle').getAttribute('aria-expanded')==='true'&&document.getElementById('chat-total').textContent==='82,400'"));
 record('expanded-usage-is-readable',await js("parseFloat(getComputedStyle(document.getElementById('thread')).fontSize)>=12&&parseFloat(getComputedStyle(document.getElementById('chat-million')).fontSize)===20"));
 record('collapse-button-stays-visible-after-scroll',await js("(()=>{const p=document.querySelector('.pages');p.scrollTop=p.scrollHeight;const b=document.getElementById('chat-usage-toggle'),r=b.getBoundingClientRect();return p.scrollTop>0&&Math.abs(r.top-window.usageActionY)<1&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===b&&b.textContent.includes('收起用量')})()"));
 await capture('task-expanded');
 snapshot.threadUsage.threads[0].totalTokens=82500;bubble.update(snapshot,anchor,true,options);await wait(60);
 record('refresh-does-not-collapse-user-selection',await js("!document.getElementById('chat-usage-details').hidden&&document.getElementById('chat-total').textContent==='82,500'"));
 await js("document.getElementById('thread').value='b';document.getElementById('thread').dispatchEvent(new Event('change'))");await wait(60);
 record('thread-selector-works-after-expansion',await js("document.getElementById('chat-total').textContent==='126,800'"));
 await js("document.getElementById('chat-usage-toggle').click()");await wait(60);
 record('collapse-restores-task-scroll-position',await js("document.querySelector('.pages').scrollTop<=1"));
 record('second-click-removes-usage-space',await js("document.getElementById('chat-usage-details').hidden&&document.getElementById('chat-usage-details').getBoundingClientRect().height===0"));
 win.showInactive();
 for(const scale of [.8,1,1.2,1.4])for(const style of ['style1','style2'])for(const page of ['task','quota','usage']){
  options.bubbleScale=scale;options.quotaStyle=style;bubble.open(page);bubble.update(snapshot,anchor,true,options);await wait(40);
  for(let i=0;i<40;i++){if(await js('Math.abs(innerWidth-300)<=2'))break;await wait(25);}
  await wait(30);
  record('usage-action-only-on-task-'+scale+'-'+style+'-'+page,await js(`document.getElementById('chat-usage-actions').hidden===${page!=='task'}&&${page==='task'?"document.getElementById('chat-usage-toggle').textContent.includes('会话用量')":"document.getElementById('chat-usage-actions').getBoundingClientRect().height===0"}`));
  record('no-horizontal-overflow-'+scale+'-'+style+'-'+page,await js("(()=>{const p=document.querySelector('.pages'),n=document.querySelector('nav');return p.scrollWidth<=p.clientWidth+1&&n.scrollWidth<=n.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1})()"));
  record('close-and-tabs-fit-'+scale+'-'+style+'-'+page,await js("(()=>{const b=document.querySelector('main').getBoundingClientRect(),els=[document.getElementById('dismiss'),...document.querySelectorAll('nav button')];return els.every(el=>{const r=el.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.bottom<=b.bottom+1})})()"));
  const containment=await contentsInside();record('all-content-inside-cloud-'+scale+'-'+style+'-'+page,containment.pass,containment);
  const cloudCheck=await js("(()=>{const svg=document.querySelector('.thought-outline'),p=svg.querySelector('path'),r=document.getElementById('dismiss').getBoundingClientRect(),m=svg.getScreenCTM().inverse();return {rect:{x:r.x,y:r.y,w:r.width,h:r.height},points:[[r.left+3,r.top+3],[r.right-3,r.top+3],[r.right-3,r.bottom-3],[r.left+3,r.bottom-3]].map(([x,y])=>{const q=new DOMPoint(x,y).matrixTransform(m);return {x:q.x,y:q.y,inside:p.isPointInFill(q)}})}})()");record('close-inside-cloud-'+scale+'-'+style+'-'+page,cloudCheck.points.every(p=>p.inside),cloudCheck);
  if(scale===1&&style==='style1'&&page!=='task')await capture(page);
 }
 options.bubbleScale=1;bubble.open('task');bubble.update(snapshot,anchor,true,options);await wait(60);
 record('tail-points-toward-pet',await js("document.querySelector('main').dataset.tail==='left'"));
 snapshot.status={state:'idle',threads:[]};options.bubblePinnedPage='task';bubble.update(snapshot,anchor,true,options);await wait(100);
 const idle=await contentsInside();record('idle-content-inside-cloud',idle.pass,idle);await capture('idle');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'real isolated software-rendered thought bubble and interactions; synthetic metadata',checks},null,2));bubble.close();app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),String(e.stack));app.exit(2);});setTimeout(()=>app.exit(3),25000);
