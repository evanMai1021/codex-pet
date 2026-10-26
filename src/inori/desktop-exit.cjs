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
 return {
  bind(value){
   if(pids.length||!Array.isArray(value)||!value.length||value.some(pid=>!Number.isInteger(pid)||pid<=0))return;
   pids=[...new Set(value)];gate(true);
  },
  shouldQuit(){
   if(!pids.length)return false;
   const states=pids.map(isAlive);
   return gate(states.includes(true)?true:states.every(state=>state===false)?false:null);
  }
 };
}
module.exports={createDesktopExitGate,createDesktopPidWatch};
