'use strict';
function createDesktopExitGate(){
 let seen=false,missing=0;
 return running=>{
  if(running===true){seen=true;missing=0;return false;}
  if(running!==false){missing=0;return false;}
  if(!seen)return false;
  return ++missing>=2;
 };
}
function createDesktopPidWatch(isAlive=pid=>{
 try{process.kill(pid,0);return true;}catch(error){return error.code==='ESRCH'?false:null;}
}){
 let pids=[];const gate=createDesktopExitGate();
 const running=()=>{
  if(!pids.length)return null;
  const states=pids.map(isAlive);
  return states.includes(true)?true:states.every(state=>state===false)?false:null;
 };
 return {
  bind(value){
   if(pids.length||!Array.isArray(value)||!value.length||value.some(pid=>!Number.isInteger(pid)||pid<=0))return;
   pids=[...new Set(value)];gate(true);
  },
  shouldQuit(){
   if(!pids.length)return false;
   return gate(running());
  },
  running
 };
}
function createPluginLeaseWatch(enabled,quit){
 const owners=new Set();
 const watch=message=>{
  if(!message||!['attach','release'].includes(message.action)||!Number.isInteger(message.pid)||message.pid<=0)throw Error('插件连接信息无效');
  if(message.action==='attach')owners.add(message.pid);
  else if(owners.delete(message.pid)&&owners.size===0&&enabled())quit();
  return {connected:owners.size};
 };
 watch.hasOwners=()=>owners.size>0;return watch;
}
module.exports={createDesktopExitGate,createDesktopPidWatch,createPluginLeaseWatch};
