'use strict';
// Experimental read-only projection. Never changes the production pet or approvals.
const TYPES=new Set(['active','idle','notLoaded','systemError']);
const FLAGS=new Set(['waitingOnApproval','waitingOnUserInput']);
function projectRuntimeStatus(runtime,{healthy=true}={}){
 const unknown=()=>({state:'unknown',approvalPending:null,source:'desktop-ipc-experimental'});
 if(!healthy||!runtime||!TYPES.has(runtime.type))return unknown();
 if(runtime.type==='notLoaded')return unknown();
 if(runtime.type==='systemError')return {state:'error',approvalPending:null,source:'desktop-ipc-experimental'};
 if(runtime.type==='idle')return {state:'idle',approvalPending:false,source:'desktop-ipc-experimental'};
 if(!Array.isArray(runtime.activeFlags)||runtime.activeFlags.some(f=>!FLAGS.has(f)))return unknown();
 const approval=runtime.activeFlags.includes('waitingOnApproval');
 return {state:approval||runtime.activeFlags.includes('waitingOnUserInput')?'waiting':'working',approvalPending:approval,source:'desktop-ipc-experimental'};
}
function projectSnapshot(change,version){
 if(version!==11||change?.type!=='snapshot')return projectRuntimeStatus(null);
 return projectRuntimeStatus(change.conversationState?.threadRuntimeStatus);
}
module.exports={projectRuntimeStatus,projectSnapshot};
