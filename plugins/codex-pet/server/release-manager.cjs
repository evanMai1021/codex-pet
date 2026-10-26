'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),crypto=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process'),integration=require('./integration.cjs');
const REPO='evanMai1021/codex-pet',API='https://api.github.com/repos/'+REPO+'/releases/latest';
function version(value){if(!/^\d+\.\d+\.\d+$/.test(value||''))throw Error('版本号无效');return value.split('.').map(Number);}
function newer(a,b){const x=version(a),y=version(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;}
function releasePlan(release){
 const v=String(release.tag_name||'').replace(/^v/,'');version(v);
 if(release.draft||release.prerelease)throw Error('仅安装正式版本');
 const assets=['inori-codex-pet-v'+v+'.zip','codex-pet-plugin-v'+v+'.zip'].map(name=>{
  const a=release.assets?.find(item=>item.name===name);
  if(!a||!/^sha256:[a-f0-9]{64}$/.test(a.digest||'')||a.size<=0||a.size>800*1024*1024||a.browser_download_url!==`https://github.com/${REPO}/releases/download/v${v}/${name}`)throw Error('正式版附件或校验信息尚未就绪');
  return {name,url:a.browser_download_url,size:a.size,sha256:a.digest.slice(7)};
 });
 return {version:v,assets};
}
function allowed(url){const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='github.com'||u.hostname==='api.github.com'||u.hostname==='release-assets.githubusercontent.com'||u.hostname==='objects.githubusercontent.com');}
function response(url,redirects=0){return new Promise((resolve,reject)=>{
 if(!allowed(url)||redirects>5)return reject(Error('下载来源无效'));
 const req=https.get(url,{headers:{'User-Agent':'Inori-Codex-Pet','Accept':'application/vnd.github+json'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){res.resume();response(new URL(res.headers.location,url).href,redirects+1).then(resolve,reject);}
  else if(res.statusCode===200)resolve(res);else{res.resume();reject(Error('版本服务暂不可用（'+res.statusCode+'）'));}
 });req.setTimeout(15000,()=>req.destroy(Error('网络连接超时')));req.on('error',reject);
 });}
async function latest(){const res=await response(API);const chunks=[];let bytes=0;for await(const chunk of res){bytes+=chunk.length;if(bytes>2*1024*1024){res.destroy();throw Error('版本信息过大');}chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function root(){const c=integration.readConfig();if(c.installRoot)return path.resolve(c.installRoot);if(c.inoriExecutable){const folder=path.dirname(c.inoriExecutable);return /^inori-codex-pet-v[\d.]+$/.test(path.basename(folder))?path.dirname(folder):path.join(folder,'versions');}return path.join(process.env.LOCALAPPDATA||os.homedir(),'CodexPet','versions');}
function stateFile(){return path.join(root(),'pet-update-state.json');}
function local(){const c=integration.readConfig();let runtimeVersion=null;try{runtimeVersion=JSON.parse(fs.readFileSync(path.join(path.dirname(c.inoriExecutable),'resources/app/package.json'),'utf8')).version;}catch{}return {pluginVersion:require('../plugin.json').version,runtimeVersion};}
let cached=null,checkedAt=0;
function status(){let state=null;try{state=JSON.parse(fs.readFileSync(stateFile(),'utf8'));}catch{}return {...local(),...(cached||{}),state};}
async function check(force=false){
 let state=null;try{state=JSON.parse(fs.readFileSync(stateFile(),'utf8'));}catch{}
 if(!cached||force||Date.now()-checkedAt>3600000){const r=await latest();const v=String(r.tag_name||'').replace(/^v/,'');version(v);cached={latestVersion:v,notes:String(r.body||'').slice(0,12000)};checkedAt=Date.now();try{releasePlan(r);cached.ready=true;}catch{cached.ready=false;}}
 const current=local();return {...current,...cached,updateAvailable:!current.runtimeVersion||newer(cached.latestVersion,current.runtimeVersion)||newer(cached.latestVersion,current.pluginVersion),state};
}
async function download(asset,file,onProgress,fetchResponse=response){
 const res=await fetchResponse(asset.url),hash=crypto.createHash('sha256');let size=0;
 const output=fs.createWriteStream(file,{flags:'wx'});let streamError;output.on('error',e=>{streamError=e;res.destroy(e);});
 try{for await(const chunk of res){size+=chunk.length;if(size>asset.size)throw Error('下载文件超过声明大小');hash.update(chunk);if(!output.write(chunk))await require('node:events').once(output,'drain');onProgress(size,asset.size);}await new Promise((resolve,reject)=>{output.end(resolve);output.once('error',reject);});if(streamError)throw streamError;}catch(e){output.destroy();res.destroy();throw e;}
 if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('下载完整性校验失败');
}
function powershell(args,env={}){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'release-helpers.ps1'),...args],{encoding:'utf8',windowsHide:true,env:{...process.env,...env},timeout:120000,stdio:['ignore','pipe','pipe']});}
async function install(){
 if(process.platform!=='win32')throw Error('当前一键安装仅支持 Windows');
 const dir=root();fs.mkdirSync(dir,{recursive:true});const lock=path.join(dir,'pet-update.lock');let handle;
 try{handle=fs.openSync(lock,'wx');}catch{
  let dead=false;try{const pid=Number(fs.readFileSync(lock,'utf8'));if(Number.isInteger(pid)&&pid>0)try{process.kill(pid,0);}catch(e){dead=e.code==='ESRCH';}}catch{}
  if(!dead)throw Error('已有更新正在进行；请在面板查看更新进度');
  fs.renameSync(lock,path.join(dir,'pet-update-stale-'+Date.now()+'.lock'));handle=fs.openSync(lock,'wx');
 }
 try{powershell(['-Mode','probe']);const child=spawn(process.execPath,[__filename,'--worker',dir],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env,INORI_UPDATE_ROOT:dir}});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});fs.writeFileSync(handle,String(child.pid));child.unref();return {started:true,message:'正在后台下载并更新，可在此查看进度。'};}catch(e){fs.unlinkSync(lock);throw e;}finally{fs.closeSync(handle);}
}
async function worker(dir,deps={}){
 const getLatest=deps.latest||latest,getDownload=deps.download||download,run=deps.powershell||powershell,launch=deps.launch||integration.launchPet;
 const file=path.join(dir,'pet-update-state.json'),lock=path.join(dir,'pet-update.lock');let stage='checking',lastWrite=0;
 const write=(patch={})=>fs.writeFileSync(file,JSON.stringify({stage,updatedAt:Date.now(),...patch}));
 let oldConfig=null,switched=false,oldStopped=false;
 try{
  write();const plan=releasePlan(await getLatest()),current=local();if(current.runtimeVersion&&!newer(plan.version,current.runtimeVersion)&&!newer(plan.version,current.pluginVersion)){stage='complete';write({version:plan.version,message:'已是最新版本'});return;}
  const work=path.join(dir,'pet-update-'+plan.version+'-'+Date.now());fs.mkdirSync(work);
  for(const asset of plan.assets){stage='downloading';write({version:plan.version,asset:asset.name});await getDownload(asset,path.join(work,asset.name),(received,total)=>{if(Date.now()-lastWrite>700){lastWrite=Date.now();write({version:plan.version,asset:asset.name,received,total});}});}
  stage='extracting';write({version:plan.version});
  for(const asset of plan.assets)run(['-Mode','extract','-Archive',path.join(work,asset.name),'-Destination',path.join(work,asset.name.includes('-plugin-')?'plugin':'app')]);
  const appFolder=path.join(work,'app','inori-codex-pet-v'+plan.version),exe=path.join(appFolder,'楪祈桌宠.exe'),pluginRoot=path.join(work,'plugin');
  const manifest=JSON.parse(fs.readFileSync(path.join(pluginRoot,'plugins/codex-pet/plugin.json'),'utf8'));
  if(!fs.existsSync(exe)||manifest.version!==plan.version||JSON.parse(fs.readFileSync(path.join(appFolder,'resources/app/package.json'),'utf8')).version!==plan.version)throw Error('程序与插件版本不一致');
  oldConfig=integration.readConfig();
  // Keep settings inside the same installation root; never touch account credentials.
  const previous=oldConfig.inoriExecutable,previousData=previous&&path.join(path.dirname(previous),'resources/run-data');
  let previousPid;try{previousPid=JSON.parse(fs.readFileSync(path.join(previousData,'settings-control.json'),'utf8')).pid;}catch{}
  stage='switching';write({version:plan.version});
  if(previousData){try{await require('./control-client.cjs').lifecycle({action:'upgrade'});oldStopped=true;}catch{
   const endpoint=path.join(previousData,'settings-control.json');
   if(fs.existsSync(endpoint)){
    const api=require('./control-client.cjs');try{const s=await api.requestSettings();await api.requestSettings({size:s.settings.size});await new Promise(r=>setTimeout(r,500));}catch{}
    const pid=JSON.parse(fs.readFileSync(endpoint,'utf8')).pid;
    run(['-Mode','stop','-Executable',previous,'-PetPid',String(pid)]);oldStopped=true;
   }
  }}
  if(previousData&&oldStopped&&Number.isInteger(previousPid)&&previousPid>0){
   let alive=true;for(let i=0;i<50&&alive;i++){try{process.kill(previousPid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)await new Promise(r=>setTimeout(r,100));}
   if(alive)run(['-Mode','stop','-Executable',previous,'-PetPid',String(previousPid)]);
  }
  const settings=previousData&&path.join(previousData,'settings.json');if(settings&&fs.existsSync(settings)){fs.mkdirSync(path.join(appFolder,'resources/run-data'),{recursive:true});fs.copyFileSync(settings,path.join(appFolder,'resources/run-data/settings.json'));}
  const config=integration.configFile();if(fs.existsSync(config))fs.copyFileSync(config,path.join(work,'runtime-before.json'));fs.mkdirSync(path.dirname(config),{recursive:true});
  fs.writeFileSync(config,JSON.stringify({...oldConfig,inoriExecutable:exe,installRoot:dir},null,2));switched=true;
  run(['-Mode','plugin','-Source',pluginRoot]);
  await launch();stage='complete';write({version:plan.version,message:'桌宠及插件已更新；重新加载插件后使用新版面板。'});
 }catch(e){if(switched&&oldConfig)fs.writeFileSync(integration.configFile(),JSON.stringify(oldConfig,null,2));if(oldStopped&&oldConfig?.inoriExecutable)try{await launch();}catch{}stage='error';write({message:e.message});if(require.main===module)process.exitCode=1;}
 finally{try{fs.unlinkSync(lock);}catch{}}
}
if(require.main===module&&process.argv[2]==='--worker')worker(path.resolve(process.argv[3]));
module.exports={check,status,install,releasePlan,newer,download,worker};
