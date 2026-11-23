'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
function configFile(){return path.join(process.env.CODEX_PET_HOME||path.join(process.env.APPDATA||os.homedir(),'CodexPet'),'runtime.json');}
function readConfig(){
 const file=configFile();if(!fs.existsSync(file))return {};
 const data=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('桌宠启动配置格式无效');return data;
}
function resolveRuntime(config){
 const exe=config.inoriExecutable;
 if(typeof exe!=='string'||!path.isAbsolute(exe)||!fs.existsSync(exe))throw Error('请先配置本机楪祈桌宠程序');
 return {exe};
}
function setFollowCodex(enabled){
 if(typeof enabled!=='boolean')throw Error('随 Codex 启动开关必须为布尔值');
 const file=configFile(),before=readConfig(),next={...before,followCodex:enabled,followMode:'plugin'};
 if(enabled)resolveRuntime(before);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(next,null,2),'utf8');
 return {followCodex:enabled};
}
function desktopSession(config){
 try{
  const app=path.join(path.dirname(config.inoriExecutable),'resources/app');
  const helper=path.join(app,'src/inori/desktop_lifecycle.py'),python=path.join(app,'runtime/python/python.exe');
  if(!fs.existsSync(helper)||!fs.existsSync(python))return null;
  const text=execFileSync(python,['-B',helper,'--session'],{windowsHide:true,encoding:'utf8',timeout:1800,maxBuffer:8192,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  const value=JSON.parse(text);return Array.isArray(value)&&value.every(v=>/^\d+:\d+$/.test(v))?value:null;
 }catch{return null;}
}
function setPetStopped(stopped){
 const file=configFile(),before=readConfig(),next={...before,petStopped:stopped===true};
 if(stopped){if(before.petStopped!==true||!('petStoppedSession'in before))next.petStoppedSession=desktopSession(before);}
 else delete next.petStoppedSession;
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(next,null,2),'utf8');
}
async function launchPet(args=[],deps={}){
 const config=(deps.read||readConfig)();
 if(config.petStopped===true)return {opened:false,stopped:true};
 const {exe}=resolveRuntime(config);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=(deps.spawn||spawn)(exe,args,{cwd:path.dirname(exe),detached:true,windowsHide:true,stdio:'ignore',env});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('桌宠启动失败')));});child.unref();
 return {opened:true,character:'inori',settings:args.includes('--settings')};
}
function createPluginStartup({read=readConfig,launch=launchPet,session=desktopSession,setStopped=setPetStopped}={}){
 let attempted=false;
 return async()=>{
  if(attempted)return {started:false,reason:'already-initialized'};
  attempted=true;
  const config=read();if(config.followCodex!==true)return {started:false,reason:'disabled'};
  if(config.petStopped===true){
   const previous=config.petStoppedSession,current=session(config);
   const newHost=Array.isArray(previous)&&Array.isArray(current)&&current.length>0&&!previous.some(id=>current.includes(id));
   if(!newHost)return {started:false,reason:'user-exited-this-session'};
   setStopped(false);
  }
  await launch(['--codex-autostart']);return {started:true};
 };
}
module.exports={configFile,readConfig,resolveRuntime,setFollowCodex,setPetStopped,desktopSession,launchPet,createPluginStartup};
