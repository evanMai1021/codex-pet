'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
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
function releaseCacheWorkingDirectory({read=readConfig,chdir=dir=>process.chdir(dir)}={}){
 const config=read(),dir=config.installRoot||(config.inoriExecutable&&path.dirname(config.inoriExecutable));
 if(!dir||!path.isAbsolute(dir)||!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())return false;
 chdir(dir);return true;
}
function setFollowCodex(enabled){
 if(typeof enabled!=='boolean')throw Error('随 Codex 启动开关必须为布尔值');
 const file=configFile(),before=readConfig(),next={...before,followCodex:enabled,followMode:'plugin'};
 if(enabled)resolveRuntime(before);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(next,null,2),'utf8');
 return {followCodex:enabled};
}
async function launchPet(args=[],deps={}){
 const {exe}=resolveRuntime((deps.read||readConfig)());
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=(deps.spawn||spawn)(exe,args,{cwd:path.dirname(exe),detached:true,windowsHide:true,stdio:'ignore',env});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('桌宠启动失败')));});child.unref();
 return {opened:true,character:'inori',settings:args.includes('--settings')};
}
function createPluginStartup({read=readConfig,launch=launchPet}={}){
 let attempted=false;
 return async()=>{
  if(attempted)return {started:false,reason:'already-initialized'};
  attempted=true;
  if(read().followCodex!==true)return {started:false,reason:'disabled'};
  await launch(['--codex-autostart']);return {started:true};
 };
}
module.exports={configFile,readConfig,resolveRuntime,setFollowCodex,launchPet,createPluginStartup,releaseCacheWorkingDirectory};
