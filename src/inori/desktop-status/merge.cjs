// Keep database lifecycle evidence; overlay only experimental live activity metadata.
'use strict';
const ACTIVE=new Set(['working','waiting','unknown']);
const LOCAL_TTL_MS=180000;
function fresh(stamp,now){return Number.isFinite(stamp)&&stamp>0&&now>=stamp&&now-stamp<=LOCAL_TTL_MS;}
function mergeDesktopStatus(local,desktop,now=Date.now()){
 const message={...local,threads:Array.isArray(local?.threads)?local.threads:[]};
 if(!desktop)return message;
 const live=new Map((desktop.threads??[]).map(t=>[t.threadId,t]));
 const threads=message.threads.map(row=>{
  if(!ACTIVE.has(row.state))return row;
  const value=live.get(row.threadId);
  const valid=desktop.connected&&desktop.protocolSupported&&value?.turnId===row.turnId&&value.synced;
  const localFresh=local.healthy===true&&fresh(local.updatedAt,now)&&fresh(row.updatedAt,now);
  const localRow=()=>({...row,approvalPending:false,statusSource:'local-lifecycle',label:row.state==='waiting'?'等待你回答 · 本地状态':'工作中 · 本地状态'});
  if(valid&&value.state==='waiting')return {...row,state:'waiting',approvalPending:value.approvalPending===true,label:value.approvalPending?'等待批准':'等待你回答',phase:null,statusSource:'desktop-ipc-experimental'};
  if(valid&&value.state==='error')return {...row,state:'error',label:'桌面状态异常',phase:null,statusSource:'desktop-ipc-experimental'};
  if(row.state==='waiting'&&localFresh)return localRow();
  if(valid&&value.state==='working')return {...row,state:'working',label:'工作中',approvalPending:false,statusSource:'desktop-ipc-experimental'};
  // A missing realtime stream must not erase independently fresh local evidence.
  // A synchronized idle/unknown stream is a conflict, not evidence of completion.
  if(!valid&&localFresh&&row.state==='working')return localRow();
  // Idle is never used to override an unfinished database turn or invent completion.
  return {...row,state:'unknown',label:'桌面状态暂不可确认',phase:null,approvalPending:null,statusSource:'desktop-ipc-experimental'};
 });
 return {...message,threads,capabilities:{...message.capabilities,approval:false,desktopStatusExperimental:true,desktopStatusConnected:desktop.connected,desktopProtocolSupported:desktop.protocolSupported,desktopStatusError:desktop.errorCode??null}};
}
module.exports={mergeDesktopStatus};
