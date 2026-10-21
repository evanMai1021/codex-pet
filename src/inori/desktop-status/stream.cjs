'use strict';
const {projectRuntimeStatus}=require('./projection.cjs');
const clone=r=>!r||typeof r!=='object'?null:{type:r.type,...(Array.isArray(r.activeFlags)?{activeFlags:[...r.activeFlags]}:{})};
const revision=n=>Number.isSafeInteger(n)&&n>=0;
class DesktopStatusStream {
 constructor(threadId,{ttlMs=180000}={}){this.threadId=threadId;this.ttlMs=ttlMs;this.connected=false;this.reset('not-connected');}
 reset(reason){this.runtime=null;this.revision=null;this.synced=false;this.lastSeen=null;this.reason=reason;}
 connect(){this.connected=true;this.reset('awaiting-snapshot');}
 disconnect(){this.connected=false;this.reset('disconnected');}
 fail(reason){this.reset(reason);return this.read();}
 read(now=Date.now()){
  const stale=this.lastSeen!==null&&now-this.lastSeen>this.ttlMs;
  if(!this.connected||!this.synced||stale)return {...projectRuntimeStatus(null),synced:false,revision:this.revision,needsResync:this.connected,reason:stale?'stale':this.reason};
  return {...projectRuntimeStatus(this.runtime),synced:true,revision:this.revision,needsResync:false,reason:'current'};
 }
 receive(m,now=Date.now()){
  if(m?.type!=='broadcast'||m.method!=='thread-stream-state-changed'||m.params?.conversationId!==this.threadId||m.params?.hostId!=='local')return this.read(now);
  if(!this.connected)return this.read(now);
  if(m.version!==11)return this.fail('unsupported-version');
  const c=m.params.change;
  if(c?.type==='snapshot'){
   if(!revision(c.revision))return this.fail('invalid-revision');
   this.runtime=clone(c.conversationState?.threadRuntimeStatus);this.revision=c.revision;this.lastSeen=now;this.synced=true;this.reason='current';return this.read(now);
  }
  if(c?.type!=='patches'||!this.synced)return this.fail('snapshot-required');
  if(!revision(c.baseRevision)||!revision(c.revision)||c.baseRevision!==this.revision||c.revision<=c.baseRevision)return this.fail('revision-gap');
  if(!Array.isArray(c.patches)||c.patches.length>10000)return this.fail('invalid-patches');
  let next=clone(this.runtime);
  for(const p of c.patches){
   if(!Array.isArray(p.path)||!['add','replace','remove'].includes(p.op))return this.fail('invalid-patch');
   const keys=p.path;
   if(keys.length===0){if(p.op==='remove')next=null;else next=clone(p.value?.threadRuntimeStatus);continue;}
   if(keys[0]!=='threadRuntimeStatus')continue;
   if(keys.length===1){next=p.op==='remove'?null:clone(p.value);continue;}
   if(!next)return this.fail('missing-runtime-base');
   if(keys.length===2&&keys[1]==='type'){if(p.op==='remove')delete next.type;else next.type=p.value;continue;}
   if(keys.length===2&&keys[1]==='activeFlags'){if(p.op==='remove')delete next.activeFlags;else if(Array.isArray(p.value))next.activeFlags=[...p.value];else return this.fail('invalid-flags');continue;}
   if(keys.length===3&&keys[1]==='activeFlags'&&Number.isSafeInteger(keys[2])&&Array.isArray(next.activeFlags)){
    const index=keys[2],flags=next.activeFlags;if(index<0||index>flags.length||((p.op==='remove'||p.op==='replace')&&index===flags.length))return this.fail('invalid-index');
    if(p.op==='remove')flags.splice(index,1);else if(p.op==='add')flags.splice(index,0,p.value);else flags[index]=p.value;continue;
   }
   return this.fail('unsupported-runtime-patch');
  }
  this.runtime=next;this.revision=c.revision;this.lastSeen=now;return this.read(now);
 }
}
module.exports={DesktopStatusStream};
