'use strict';
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path');
const out=process.env.INORI_TEST_OUT;if(!out||!process.env.INORI_DATA_DIR)throw Error('Isolated paths required');fs.mkdirSync(out,{recursive:true});
const root=process.env.INORI_TEST_ROOT||path.resolve(__dirname,'../src/inori');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
app.whenReady().then(async()=>{
 const bubble=require(path.join(root,'task-bubble.cjs')).createTaskBubble({hidden:true}),area=screen.getPrimaryDisplay().workArea,anchor={x:area.x+area.width/2,y:area.y+area.height/2,width:100,height:100};
 let win;
 for(const scale of [.8,1,1.4])for(const state of ['working','waiting','completed','error']){
  const status={state,title:'模拟任务 · 优化桌宠任务气泡的排版与交互',phase:'正在核对气泡布局',publicProgress:'这是一段较长的公开进度，用于检查文字换行以后是否仍然能够完整放在气泡范围内。',approvalPending:state==='waiting',statusSource:'desktop-ipc-experimental',threads:[{},{}]};
  bubble.update({status},anchor,true,{bubbleScale:scale});
  for(let attempt=0;attempt<50;attempt++){
   await wait(50);bubble.update({status},anchor,true,{bubbleScale:scale});
   win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='楪祈 · 任务气泡');
   if(win&&!win.webContents.isLoading()&&await win.webContents.executeJavaScript("document.querySelector('main').dataset.state")===state)break;
  }
  const result=await win.webContents.executeJavaScript(`(()=>{const main=document.querySelector('main'),box=main.getBoundingClientRect(),elements=[...main.querySelectorAll('button,h1,p,small,#stage')].filter(el=>!el.hidden);return{removed:!document.getElementById('more')&&!('settings' in window.taskBubble),state:main.dataset.state,fits:elements.every(el=>el.getBoundingClientRect().bottom<=box.bottom-5),headline:document.getElementById('headline').textContent};})()`);
  checks.push({name:state+'-'+scale,pass:result.removed&&result.state===state&&result.fits,...result});
  if(scale===1){await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(50);fs.writeFileSync(path.join(out,state+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
 }
 const before=await win.webContents.executeJavaScript("document.getElementById('headline').textContent");await win.webContents.executeJavaScript("document.getElementById('headline').click()");await wait(80);
 checks.push({name:'click-still-cycles-phrases',pass:before!==await win.webContents.executeJavaScript("document.getElementById('headline').textContent")});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:checks.every(c=>c.pass),mode:'actual packaged bubble renderer with synthetic tasks',checks},null,2));bubble.close();app.exit(checks.every(c=>c.pass)?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'error.txt'),e.stack);app.exit(2);});setTimeout(()=>app.exit(3),20000);
