// Window/tray lifecycle adapted from G-ShiSi/codex-on-desk (MIT).
// This entry point never imports its managed/external session runtime.
'use strict';
const {app,BrowserWindow,ipcMain,Menu,nativeImage,screen,Tray}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const {DesktopStatusClient}=require('./desktop-status/client.cjs');
const {mergeDesktopStatus}=require('./desktop-status/merge.cjs');
let desktopStatus=null;
let settingsPanel=null,settingsControl=null;
let localStatus={kind:'status',healthy:false,threads:[],capabilities:{approval:false}};
const {aggregate,bounded,visibleBounds,chooseEdge,chooseDropEdge,dockBounds,normalizeQuota,quotaFailure}=require('./core.cjs');
const {normalizeSkin}=require('./skins.cjs');
const integration=require('./integration.cjs');
const desktopExitGate=require('./desktop-exit.cjs').createDesktopExitGate();
const WIDTH=300,HEIGHT=560;
const ROOT=path.resolve(__dirname,'../..');
const DATA=process.env.INORI_DATA_DIR||(app.isPackaged?path.resolve(ROOT,'../run-data'):path.join(ROOT,'run-data'));
fs.mkdirSync(DATA,{recursive:true});app.setPath('userData',DATA);app.setName('楪祈 Codex 桌宠 0.1.12');
const smoke=process.argv.includes('--smoke');
const liveCheck=process.argv.includes('--live-check');
let win,tray,bridge,quitting=false,hovered=false,urgentTimer,saveTimer,drag=null,regions=[],settlePlacement=false;
let settings={bubbleTone:'cute',bubbleCustomLine:'',bubbleEnabled:true,skin:'redwhite',dock:null,dockEnabled:true,size:1,reduced:false,accountFingerprint:null,x:null,y:null};
try{Object.assign(settings,JSON.parse(fs.readFileSync(path.join(DATA,'settings.json'),'utf8')));}catch{}
settings.skin=normalizeSkin(settings.skin);
settings.size=[.8,1,1.2].includes(settings.size)?settings.size:1;
settings.dock=['left','right','top','bottom'].includes(settings.dock)?settings.dock:null;
settings.dockEnabled=settings.dockEnabled!==false;if(!settings.dockEnabled)settings.dock=null;
let snapshot={skin:settings.skin,status:aggregate([],false),quota:{health:'connecting',windows:[],updatedAt:null},dock:settings.dock,peek:false,reduced:!!settings.reduced,capabilities:{approval:false},lastInteraction:Date.now(),poseCandidates:false};
let lastUrgent='';let lastQuotaRequest=0;let lastResetRefresh=0;let bridgeStopping=false;
const taskBubble=require('./task-bubble.cjs').createTaskBubble({onSettings:()=>settingsPanel?.open()});
function updateTaskBubble(){
 if(quitting||!win||win.isDestroyed())return;
 const b=win.getBounds(),r=regions[0],s=b.width/WIDTH;
 const anchor=r?{x:Math.round(b.x+r.x*s),y:Math.round(b.y+r.y*s),width:Math.max(1,Math.round(r.width*s)),height:Math.max(1,Math.round(r.height*s))}:b;
 taskBubble.update(snapshot,anchor,settings.bubbleEnabled!==false&&win.isVisible()&&!smoke&&!liveCheck&&!process.argv.includes('--settings-self-test'),settings);
}
function setBubbleEnabled(value){settings.bubbleEnabled=value;save();updateTaskBubble();settingsPanel?.publish();tray?.setContextMenu(menu());}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const b=win?.getBounds();fs.writeFileSync(path.join(DATA,'settings.json'),JSON.stringify({...settings,...(b?{x:b.x,y:b.y}:{})},null,2));}catch{}},250);}
function send(){if(win&&!win.isDestroyed())win.webContents.send('inori:snapshot',snapshot);settingsPanel?.publish();}
function refreshQuota(){if(Date.now()-lastQuotaRequest<5000)return;lastQuotaRequest=Date.now();bridge?.stdin?.write('{"command":"refreshQuota"}\n');}
function peek(value){snapshot.peek=value;send();}
function publishStatus(){
  const message=mergeDesktopStatus(localStatus,desktopStatus?.snapshot());
  snapshot.status=aggregate(message.threads,!!message.healthy);snapshot.capabilities=message.capabilities??{};
  const key=snapshot.status.state+':'+(snapshot.status.turnId??'');
  if(['waiting','error'].includes(snapshot.status.state)&&key!==lastUrgent){lastUrgent=key;clearTimeout(urgentTimer);peek(true);urgentTimer=setTimeout(()=>peek(false),4000);}
  send();
}
function takeMessage(message){
  if(message.kind==='desktopLifecycle'){
    if(!quitting&&desktopExitGate(message.running))app.quit();
    return;
  }
  if(message.kind==='status'){
    localStatus=message;
    desktopStatus?.setThreads(message.threads??[]);
    publishStatus();return;
  }else if(message.kind==='quota'){
    if(message.healthy){
      const normalized=normalizeQuota(message,message.updatedAt);
      snapshot.quota={...normalized,fingerprint:message.fingerprint,accountLabel:message.accountLabel};
      if(!settings.accountFingerprint)snapshot.quota.health='unverified';
      else if(settings.accountFingerprint!==message.fingerprint){snapshot.quota.health='account-mismatch';snapshot.quota.windows=[];}
    }else snapshot.quota=quotaFailure(snapshot.quota,settings.accountFingerprint);
  }
  send();
}
function startBridge(){
  const embedded=path.join(ROOT,'runtime','python','python.exe');
  const python=process.env.INORI_PYTHON||(fs.existsSync(embedded)?embedded:'python');
  bridge=spawn(python,['-u',path.join(__dirname,'bridge.py')],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'}});
  readline.createInterface({input:bridge.stdout}).on('line',line=>{try{takeMessage(JSON.parse(line));}catch{}});
  bridge.on('error',()=>{localStatus={kind:'status',healthy:false,threads:[],capabilities:{approval:false}};desktopStatus?.setThreads([]);snapshot.quota.health='unavailable';publishStatus();});
  bridge.on('exit',()=>{if(!quitting){localStatus={kind:'status',healthy:false,threads:[],capabilities:{approval:false}};desktopStatus?.setThreads([]);snapshot.quota.health='stale';publishStatus();}});
}
function currentArea(){
 const b=win.getBounds(),r=regions[0],scale=b.width/WIDTH;
 const visible=r?{x:Math.round(b.x+r.x*scale),y:Math.round(b.y+r.y*scale),width:Math.max(1,Math.round(r.width*scale)),height:Math.max(1,Math.round(r.height*scale))}:b;
 return screen.getDisplayMatching(visible).workArea;
}
function relocate(area=currentArea()){
 if(!win)return;
 const b=win.getBounds();
 const bounds=settings.dock?dockBounds(b,area,settings.dock,regions.filter(r=>r.kind!=='hit'),b.width/WIDTH):visibleBounds(b,area,regions,b.width/WIDTH);
 win.setBounds(bounds);save();send();
}
function resizePet(size){
  settings.size=size;settlePlacement=true;
  // Windows fixes native min/max tracking sizes when a window is non-resizable.
  // Temporarily unlock it for programmatic shrinking, then restore the lock.
  win.setResizable(true);win.setMinimumSize(0,0);win.setMaximumSize(0,0);
  win.setSize(Math.round(WIDTH*size),Math.round(HEIGHT*size));win.setResizable(false);
  relocate();tray?.setContextMenu(menu());
}
function setSkin(id){settings.skin=normalizeSkin(id);snapshot.skin=settings.skin;settlePlacement=true;save();send();}
function setDockEnabled(value){settings.dockEnabled=value;setDock(value?settings.dock:null);}
function setDock(edge){if(edge&&!settings.dockEnabled)return;settlePlacement=settings.dock!==edge;settings.dock=edge;snapshot.dock=edge;snapshot.peek=false;relocate();tray?.setContextMenu(menu());}
function menu(){return Menu.buildFromTemplate([
  {label:'楪祈桌宠 0.1.12',enabled:false},
  {label:'打开楪祈设置',click:()=>settingsPanel?.open()},
  {label:'显示任务气泡',type:'checkbox',checked:settings.bubbleEnabled!==false,click:()=>setBubbleEnabled(settings.bubbleEnabled===false)},
  {label:win?.isVisible()?'隐藏宠物':'显示宠物',click:()=>{if(win.isVisible())win.hide();else win.showInactive();}},
  {label:'回到屏幕中间 / 解除停靠',click:()=>{settings.dock=null;snapshot.dock=null;const a=screen.getPrimaryDisplay().workArea;win.setPosition(Math.round(a.x+(a.width-WIDTH*settings.size)/2),Math.round(a.y+(a.height-HEIGHT*settings.size)/2));snapshot.lastInteraction=Date.now();save();send();}},
  {label:'允许趴边',type:'checkbox',checked:settings.dockEnabled,click:()=>setDockEnabled(!settings.dockEnabled)},
  {label:'趴边',enabled:settings.dockEnabled,submenu:[['left','左边'],['right','右边'],['top','上边'],['bottom','下边']].map(([edge,label])=>({label,type:'radio',checked:settings.dock===edge,click:()=>setDock(edge)}))},
  {label:'大小',submenu:[.8,1,1.2].map((size,i)=>({label:['小','标准','大'][i],type:'radio',checked:settings.size===size,click:()=>{resizePet(size);}}))},
  {label:'减少动态',type:'checkbox',checked:!!settings.reduced,click:()=>{settings.reduced=!settings.reduced;snapshot.reduced=settings.reduced;save();send();}},
  {label:'刷新额度（只读）',click:refreshQuota},
  {type:'separator'},{label:'退出楪祈桌宠',click:()=>app.quit()}
]);}
function shutdownBridge(){
  if(bridgeStopping)return;bridgeStopping=true;desktopStatus?.stop();
  if(bridge&&!bridge.killed){try{bridge.stdin.write('{"command":"quit"}\n');bridge.stdin.end();}catch{}}
}
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',(_event,argv)=>{if(argv.includes('--settings'))settingsPanel?.open();else if(!argv.includes('--codex-autostart')&&!argv.includes('--control-only'))win?.showInactive();});
  app.on('before-quit',event=>{
    if(quitting)return;event.preventDefault();quitting=true;clearTimeout(saveTimer);
    try{fs.writeFileSync(path.join(DATA,'settings.json'),JSON.stringify({...settings,x:win?.getBounds().x,y:win?.getBounds().y},null,2));}catch{}
    settingsControl?.close();taskBubble.close();shutdownBridge();setTimeout(()=>{if(bridge&&!bridge.killed)bridge.kill();app.exit(0);},3500);
  });
  app.whenReady().then(async()=>{
    const a=screen.getPrimaryDisplay().workArea;
    const initial=bounded({x:settings.x??a.x+a.width-330,y:settings.y??a.y+a.height-580,width:Math.round(WIDTH*settings.size),height:Math.round(HEIGHT*settings.size)},a);
    win=new BrowserWindow({...initial,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,maximizable:false,minimizable:false,fullscreenable:false,alwaysOnTop:true,skipTaskbar:true,show:!smoke&&!liveCheck&&!process.argv.includes('--control-only'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
    win.on('close',e=>{if(!quitting){e.preventDefault();win.hide();}});
    win.webContents.on('did-finish-load',send);
    const icon=path.resolve(ROOT,'src/electron/assets/tray-icon.png');
    tray=new Tray(nativeImage.createFromPath(icon).resize({width:20,height:20}));tray.setToolTip('楪祈 · Codex 状态源候选');tray.setContextMenu(menu());tray.on('double-click',()=>win.showInactive());
    ipcMain.handle('inori:get',()=>snapshot);
    let firstContent=true,panelVisible=false;
    ipcMain.on('inori:regions',(_event,value)=>{
      if(!Array.isArray(value)||value[0]?.skinId&&value[0].skinId!==settings.skin)return;
      const next=value.filter(r=>['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0).slice(0,8);
      if(!next.length)return;
      const nextPanel=next.some(r=>r.kind==='panel'),opening=nextPanel&&!panelVisible;
      panelVisible=nextPanel;regions=next;
      // Restore saved free coordinates only after the renderer has measured ink.
      // Later animation frames must not move the native window.
      if(firstContent){firstContent=false;settlePlacement=false;if(Number.isFinite(settings.x)&&Number.isFinite(settings.y))win.setPosition(settings.x,settings.y);relocate();}
      else if((settlePlacement||opening)&&!drag){settlePlacement=false;relocate();}
    });
    ipcMain.on('inori:hover',(_event,value)=>{if(!drag)hovered=!!value;});
    ipcMain.on('inori:interact',()=>{snapshot.lastInteraction=Date.now();send();});
    ipcMain.on('inori:press',()=>{drag={start:screen.getCursorScreenPoint(),bounds:win.getBounds(),active:false,oldDock:settings.dock};});
    ipcMain.on('inori:drag',()=>{if(!drag)return;drag.active=true;const p=screen.getCursorScreenPoint(),dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.hypot(dx,dy)>48){settings.dock=null;snapshot.dock=null;}win.setPosition(Math.round(drag.bounds.x+dx),Math.round(drag.bounds.y+dy));});
    ipcMain.on('inori:release',()=>{if(drag?.active){const cursor=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(cursor).workArea;const b=win.getBounds(),scale=b.width/WIDTH,r=regions[0];
      const pet=r?{x:b.x+r.x*scale,y:b.y+r.y*scale,width:r.width*scale,height:r.height*scale}:b;
      // Keep the current edge while dragging along it, including at corners.
      // A perpendicular drag still detaches or selects another edge.
      const oldEdge=drag.oldDock;
      const across=['left','right'].includes(oldEdge)?cursor.x-drag.start.x:cursor.y-drag.start.y;
      const preferredEdge=oldEdge&&Math.abs(across)<=24*scale?oldEdge:null;
      const nextDock=settings.dockEnabled?chooseDropEdge(pet,area,cursor,24,preferredEdge):null;
      settlePlacement=settings.dock!==nextDock;settings.dock=nextDock;snapshot.dock=settings.dock;snapshot.peek=false;relocate(area);}drag=null;snapshot.lastInteraction=Date.now();save();send();});
    ipcMain.on('inori:menu',()=>menu().popup({window:win}));
    ipcMain.on('inori:refresh',refreshQuota);
    ipcMain.on('inori:confirmAccount',(_event,fingerprint)=>{if(typeof fingerprint==='string'&&fingerprint===snapshot.quota.fingerprint){settings.accountFingerprint=fingerprint;snapshot.quota.health='ok';save();send();}});
    for(const event of ['display-removed','display-added','display-metrics-changed'])screen.on(event,()=>relocate());
    settingsPanel=require('./settings/controller.cjs').createSettingsPanel({
      hidden:process.argv.includes('--settings-self-test'),
      get:()=>({bubbleTone:settings.bubbleTone,bubbleCustomLine:settings.bubbleCustomLine,bubbleEnabled:settings.bubbleEnabled!==false,followCodex:integration.readConfig().followCodex===true,skin:settings.skin,size:settings.size,dock:settings.dock,dockEnabled:settings.dockEnabled,reduced:settings.reduced,visible:win.isVisible(),status:snapshot.status}),
      apply:patch=>{for(const key of ['bubbleTone','bubbleCustomLine'])if(key in patch)settings[key]=patch[key];updateTaskBubble();if('bubbleEnabled'in patch)setBubbleEnabled(patch.bubbleEnabled);if('followCodex'in patch)integration.setFollowCodex(patch.followCodex);if('skin'in patch)setSkin(patch.skin);if('dockEnabled'in patch)setDockEnabled(patch.dockEnabled);if('size'in patch)resizePet(patch.size);if('dock'in patch)setDock(patch.dock);if('reduced'in patch){settings.reduced=patch.reduced;snapshot.reduced=patch.reduced;}if('visible'in patch){if(patch.visible)win.showInactive();else win.hide();}save();send();tray?.setContextMenu(menu());}
    });
    await win.loadFile(path.join(__dirname,'renderer/index.html'));relocate();
    settingsControl=await require('./settings/control-server.cjs').startControlServer(settingsPanel,DATA);
    if(process.argv.includes('--settings'))await settingsPanel.open();
    if(!process.argv.includes('--no-bridge')){desktopStatus=new DesktopStatusClient({onUpdate:()=>{if(!quitting)publishStatus();}});desktopStatus.start();startBridge();}
    setInterval(()=>{
      if(!win||win.isDestroyed())return;
      updateTaskBubble();
      const p=screen.getCursorScreenPoint(),b=win.getBounds(),x=(p.x-b.x)/(b.width/WIDTH),y=(p.y-b.y)/(b.width/WIDTH);
      const hit=!!drag?.active||regions.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
      win.setIgnoreMouseEvents(!hit,{forward:true});
      const now=Date.now();const crossed=snapshot.quota.windows.some(w=>w.resetsAt&&now>=w.resetsAt*1000&&snapshot.quota.updatedAt<w.resetsAt*1000);
      if(crossed&&now-lastResetRefresh>120000){lastResetRefresh=now;refreshQuota();}
    },100);
    if(liveCheck)await runLiveCheck();else if(smoke)await runSmoke();
  }).catch(()=>{process.exitCode=1;app.exit(1);});
}
async function runLiveCheck(){
  const out=process.env.INORI_SMOKE_DIR||path.resolve(ROOT,'live-check');fs.mkdirSync(out,{recursive:true});
  const deadline=Date.now()+28000;
  while(Date.now()<deadline&&snapshot.quota.health==='connecting')await new Promise(r=>setTimeout(r,200));
  await win.webContents.executeJavaScript('pinned=true;layout();paint()');
  await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(r=>setTimeout(r,650));
  fs.writeFileSync(path.join(out,'live.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  fs.writeFileSync(path.join(out,'live.json'),JSON.stringify({mode:'actual-official-quota-and-local-metadata',quotaQueryPassed:['unverified','ok'].includes(snapshot.quota.health)&&snapshot.quota.windows.length>0,accountConfirmed:snapshot.quota.health==='ok',quota:snapshot.quota.windows,quotaUpdatedAt:snapshot.quota.updatedAt,status:snapshot.status.state,threadPrefix:snapshot.status.threadId?.slice(0,8),title:snapshot.status.title,phase:snapshot.status.phase,workingVerified:snapshot.status.state==='working',threadCount:snapshot.status.threads.length,approvalVerified:!!snapshot.capabilities.approval,fullLifecycleVerified:false},null,2));
  app.quit();
}
async function runSmoke(){
  const out=process.env.INORI_SMOKE_DIR||path.resolve(ROOT,'smoke');fs.mkdirSync(out,{recursive:true});
  const results=[];
  for(const edge of [null,'left','right','top','bottom']){
    snapshot={...snapshot,dock:edge,peek:false,reduced:true,status:{state:'working',label:'预览 · 模拟工作状态',threads:[]},quota:{health:'preview',windows:[{label:'5小时',remaining:62,resetsAt:Math.floor(Date.now()/1000)+3600},{label:'每周',remaining:86,resetsAt:Math.floor(Date.now()/1000)+86400}],updatedAt:Date.now()}};
    send();await new Promise(r=>setTimeout(r,300));
    await win.webContents.executeJavaScript('paint()');
    // capturePage wakes a hidden compositor; discard its previous-frame capture.
    await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    await win.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await new Promise(r=>setTimeout(r,700));
    await win.webContents.executeJavaScript('paint()');
    const im=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});fs.writeFileSync(path.join(out,`${edge??'free'}.png`),im.toPNG());
    const check=await win.webContents.executeJavaScript('window.inoriSmokeState()');results.push({edge,...check});
  }
  snapshot={...snapshot,dock:null,peek:true};send();await new Promise(r=>setTimeout(r,200));
  await win.webContents.executeJavaScript("document.getElementById('chip').click()");
  await new Promise(r=>setTimeout(r,250));
  await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
  await new Promise(r=>setTimeout(r,700));
  await win.webContents.executeJavaScript('paint()');
  fs.writeFileSync(path.join(out,'panel.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  results.push({scenario:'quota-panel-open',...(await win.webContents.executeJavaScript('window.inoriSmokeState()'))});
  fs.writeFileSync(path.join(out,'smoke.json'),JSON.stringify({mode:'simulated-ui-only',results},null,2));
  app.quit();
}
