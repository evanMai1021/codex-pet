'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mergeDesktopStatus:merge}=require('../src/inori/desktop-status/merge.cjs');
const {aggregate}=require('../src/inori/core.cjs');
const {taskBubble}=require('../src/inori/bubble-model.cjs');
const NOW=1800000000000;
const row=(extra={})=>({threadId:'fixture',turnId:'turn',state:'working',label:'工作中',phase:'正在思考',updatedAt:NOW-1000,...extra});
const local=(r=row(),extra={})=>({healthy:true,updatedAt:NOW,threads:[r],...extra});
const offline={connected:false,protocolSupported:true,threads:[]};
const live=(state,extra={})=>({connected:true,protocolSupported:true,threads:[{threadId:'fixture',turnId:'turn',state,synced:true,...extra}]});
const first=(l,d=offline)=>merge(l,d,NOW).threads[0];

test('disconnected desktop keeps fresh local work through aggregate and bubble',()=>{
 const m=merge(local(),offline,NOW),s=aggregate(m.threads,m.healthy,NOW),b=taskBubble({status:s});
 assert.equal(s.state,'working');assert.equal(s.statusSource,'local-lifecycle');
 assert.equal(b.count,1);assert.match(b.stage,/本地/);assert.equal(m.capabilities.desktopStatusConnected,false);
 assert.equal(s.approvalPending,false);
});
test('fresh explicit local input wait survives without claiming approval',()=>{
 const r=first(local(row({state:'waiting',approvalPending:true})));
 assert.equal(r.state,'waiting');assert.equal(r.approvalPending,false);assert.equal(r.label,'等待你回答 · 本地状态');
});
test('stale, missing and future local evidence remain unknown',()=>{
 for(const updatedAt of [NOW-180001,0,undefined,NaN,NOW+1])assert.equal(first(local(row({updatedAt}))).state,'unknown');
 assert.equal(first(local(row({updatedAt:NOW-180000}))).state,'working');
});
test('healthy rows cannot mask an unreadable or stale local snapshot',()=>{
 for(const extra of [{healthy:false},{updatedAt:NOW-180001},{updatedAt:NOW+1},{updatedAt:undefined}])assert.equal(first(local(row(),extra)).state,'unknown');
});
test('local unknown is never promoted and stale approvals are cleared',()=>{
 const r=first(local(row({state:'unknown',approvalPending:true})));
 assert.equal(r.state,'unknown');assert.equal(r.approvalPending,null);assert.equal(r.phase,null);
});
test('unsynced, missing, wrong-turn and unsupported streams use fresh local evidence',()=>{
 for(const d of [live('working',{synced:false}),live('working',{turnId:'old'}),{...live('working'),threads:[]},{...live('working'),protocolSupported:false}])assert.equal(first(local(),d).statusSource,'local-lifecycle');
});
test('synchronized idle or unknown cannot be reinterpreted as local working',()=>{
 for(const state of ['idle','unknown'])assert.equal(first(local(),live(state)).state,'unknown');
});
test('synchronized realtime waiting, work and error take precedence',()=>{
 const waiting=first(local(),live('waiting',{approvalPending:true}));assert.equal(waiting.state,'waiting');assert.equal(waiting.approvalPending,true);
 assert.equal(first(local(),live('working')).statusSource,'desktop-ipc-experimental');
 assert.equal(first(local(),live('error')).state,'error');
});
test('terminal lifecycle evidence is not rewritten by disconnect',()=>{
 for(const state of ['completed','interrupted','error','idle']){const r=row({state});assert.deepEqual(first(local(r)),r);}
});
test('transport diagnostics do not change state or imply approval support',()=>{
 const m=merge(local(),{...offline,errorCode:'ENOENT'},NOW);
 assert.equal(m.capabilities.desktopStatusError,'ENOENT');assert.equal(m.capabilities.approval,false);
});
