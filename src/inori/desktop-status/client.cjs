// Read-only local desktop metadata client. Does not start turns or answer approvals.
'use strict';
const net=require('node:net');
const crypto=require('node:crypto');
const {DesktopStatusStream}=require('./stream.cjs');
const ACTIVE=new Set(['working','waiting','unknown']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class DesktopStatusClient {
 constructor({onUpdate=()=>{},ttlMs=180000}={}){
  this.onUpdate=onUpdate;this.ttlMs=ttlMs;this.entries=new Map();this.socket=null;this.clientId=null;
  this.timer=null;this.retry=null;this.connectionTimer=null;this.stopping=false;this.started=false;
  this.signature=null;this.failures=0;this.protocolUnsupported=false;this.frameLimit=8*1024*1024;
 }
 start(){
  if(this.started||this.stopping)return;this.started=true;this.connect();
  this.timer=setInterval(()=>{
   for(const [id,entry] of this.entries){if(entry.stream.read().needsResync)this.resync(id,entry);}
   this.emit();
  },1000);
 }
 setThreads(threads){
  const wanted=new Map();
  for(const row of Array.isArray(threads)?threads:[]){
   if(wanted.size>=64)break;
   if(UUID.test(row?.threadId??'')&&ACTIVE.has(row.state)&&typeof row.turnId==='string')wanted.set(row.threadId,row.turnId);
  }
  for(const [id] of this.entries){if(!wanted.has(id)){this.follow(id,false);this.entries.delete(id);}}
  for(const [id,turnId] of wanted){
   const old=this.entries.get(id);
   if(old&&old.turnId===turnId)continue;
   if(old)this.follow(id,false);
   const entry={turnId,stream:new DesktopStatusStream(id,{ttlMs:this.ttlMs}),lastResync:0,unsupported:false};
   this.entries.set(id,entry);
   if(this.clientId){entry.stream.connect();this.follow(id,true);}
  }
  this.emit();
 }
 snapshot(){
  return {connected:!!this.clientId&&!this.stopping,protocolSupported:!this.protocolUnsupported,
   threads:[...this.entries].map(([threadId,e])=>({threadId,turnId:e.turnId,...e.stream.read()}))};
 }
 emit(){
  if(this.stopping)return;
  const value=this.snapshot();
  const signature=JSON.stringify({connected:value.connected,protocolSupported:value.protocolSupported,threads:value.threads.map(t=>({threadId:t.threadId,turnId:t.turnId,state:t.state,approvalPending:t.approvalPending,synced:t.synced,reason:t.reason}))});
  if(signature!==this.signature){this.signature=signature;this.onUpdate(value);}
 }
 send(value){
  if(!this.socket?.writable||this.stopping)return false;
  try{const data=Buffer.from(JSON.stringify(value),'utf8');const header=Buffer.alloc(4);header.writeUInt32LE(data.length);this.socket.write(Buffer.concat([header,data]));return true;}
  catch{this.socket?.destroy();return false;}
 }
 follow(threadId,following){
  if(!this.clientId)return;
  this.send({type:'broadcast',method:'thread-stream-following-changed',sourceClientId:this.clientId,version:1,params:{conversationId:threadId,hostId:'local',following}});
 }
 resync(id,entry){
  if(!this.clientId||entry.unsupported||this.protocolUnsupported||Date.now()-entry.lastResync<3000)return;
  entry.lastResync=Date.now();this.follow(id,false);this.follow(id,true);
 }
 handle(message,initializeId){
  if(message?.type==='response'&&message.requestId===initializeId){
   if(message.resultType!=='success'||typeof message.result?.clientId!=='string'){this.socket?.destroy();return;}
   clearTimeout(this.connectionTimer);this.clientId=message.result.clientId;this.failures=0;
   for(const [id,e] of this.entries){e.stream.connect();this.follow(id,true);}this.emit();return;
  }
  if(message?.type==='client-discovery-request'){
   this.send({type:'client-discovery-response',requestId:message.requestId,response:{canHandle:false}});return;
  }
  if(message?.type==='request'){
   this.send({type:'response',requestId:message.requestId,resultType:'error',error:'no-handler-for-request'});return;
  }
  if(message?.type!=='broadcast')return;
  if(Array.isArray(message.targetClientIds)&&!message.targetClientIds.includes(this.clientId))return;
  const id=message.params?.conversationId,entry=this.entries.get(id);
  if(!entry||message.params?.hostId!=='local')return;
  if(message.method==='thread-stream-following-status-requested'){this.follow(id,true);return;}
  if(message.method!=='thread-stream-state-changed')return;
  entry.stream.receive(message);
  if(message.version!==11){
   this.protocolUnsupported=true;
   for(const e of this.entries.values()){e.unsupported=true;e.stream.fail('unsupported-version');}
   this.emit();this.socket?.destroy();return;
  }
  if(entry.stream.read().needsResync)this.resync(id,entry);
  this.emit();
 }
 connect(){
  if(this.stopping||this.protocolUnsupported)return;
  this.clientId=null;let buffer=Buffer.alloc(0);const initializeId=crypto.randomUUID();
  const socket=net.createConnection('\\\\.\\pipe\\codex-ipc');this.socket=socket;
  for(const e of this.entries.values())e.stream.connect();this.emit();
  this.connectionTimer=setTimeout(()=>socket.destroy(),8000);
  socket.on('connect',()=>{this.send({type:'request',requestId:initializeId,sourceClientId:'initializing-client',version:0,method:'initialize',params:{clientType:'inori-pet-candidate'}});});
  socket.on('data',chunk=>{
   if(this.socket!==socket||this.stopping)return;
   buffer=Buffer.concat([buffer,chunk]);
   while(buffer.length>=4){
    const size=buffer.readUInt32LE(0);
    if(size===0||size>this.frameLimit){socket.destroy();return;}
    if(buffer.length<size+4)return;
    const frame=buffer.subarray(4,size+4);buffer=buffer.subarray(size+4);
    try{this.handle(JSON.parse(frame.toString('utf8')),initializeId);}
    catch{socket.destroy();return;}
   }
  });
  socket.on('error',()=>{});
  socket.on('close',()=>{
   if(this.socket!==socket)return;
   clearTimeout(this.connectionTimer);this.socket=null;this.clientId=null;buffer=Buffer.alloc(0);
   for(const e of this.entries.values())e.stream.disconnect();this.emit();
   if(!this.stopping&&!this.protocolUnsupported){const delay=[1000,2000,5000,15000,30000][Math.min(this.failures++,4)];this.retry=setTimeout(()=>this.connect(),delay);}
  });
 }
 stop(){
  if(this.stopping)return;
  for(const [id] of this.entries)this.follow(id,false);
  this.stopping=true;clearInterval(this.timer);clearTimeout(this.retry);clearTimeout(this.connectionTimer);
  const socket=this.socket;this.clientId=null;for(const e of this.entries.values())e.stream.disconnect();
  socket?.end();const cleanup=setTimeout(()=>socket?.destroy(),100);cleanup.unref();
 }
}
module.exports={DesktopStatusClient};
