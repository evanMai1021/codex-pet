// Keep database lifecycle evidence; overlay only experimental live activity metadata.
'use strict';
const ACTIVE=new Set(['working','waiting','unknown']);
function mergeDesktopStatus(local,desktop){
 const message={...local,threads:Array.isArray(local?.threads)?local.threads:[]};
 if(!desktop)return message;
 const live=new Map((desktop.threads??[]).map(t=>[t.threadId,t]));
 const threads=message.threads.map(row=>{
  if(!ACTIVE.has(row.state))return row;
  const value=live.get(row.threadId);
  const valid=desktop.connected&&desktop.protocolSupported&&value?.turnId===row.turnId&&value.synced;
  if(valid&&value.state==='waiting')return {...row,state:'waiting',approvalPending:value.approvalPending===true,label:value.approvalPending?'等待批准':'等待你回答',phase:null,statusSource:'desktop-ipc-experimental'};
  if(row.state==='waiting')return row;
  if(valid&&value.state==='working')return {...row,state:'working',label:'工作中',statusSource:'desktop-ipc-experimental'};
  if(valid&&value.state==='error')return {...row,state:'error',label:'桌面状态异常',phase:null,statusSource:'desktop-ipc-experimental'};
  // Idle is never used to override an unfinished database turn or invent completion.
  return {...row,state:'unknown',label:'桌面状态暂不可确认',phase:null,statusSource:'desktop-ipc-experimental'};
 });
 return {...message,threads,capabilities:{...message.capabilities,approval:false,desktopStatusExperimental:true,desktopStatusConnected:desktop.connected,desktopProtocolSupported:desktop.protocolSupported}};
}
module.exports={mergeDesktopStatus};
