'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
// Only accepts the ChildProcess owned by this desktop pet, never a process name.
function stopOwnedProcessTree(child){
 if(!child||!Number.isInteger(child.pid)||child.exitCode!==null)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  let done=false,kill;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve();};
  const timer=setTimeout(()=>{kill?.kill();finish(Error('Owned process tree shutdown timed out'));},2000);
  if(process.platform==='win32'){
   kill=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32/taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
   kill.once('error',finish);kill.once('exit',code=>finish(code===0||child.exitCode!==null?null:Error('Owned process tree shutdown failed')));
  }else{
   child.once('exit',()=>finish());child.once('error',finish);child.kill('SIGTERM');
  }
 });
}
module.exports={stopOwnedProcessTree};
