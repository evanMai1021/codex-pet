(function(root){
 'use strict';
 function quotaView(quota={}){
  const health=quota.health||'connecting',usable=['ok','stale','preview'].includes(health);
  const windows=usable&&Array.isArray(quota.windows)?quota.windows:[];
  const rows=(windows.length?windows:[{label:'额度窗口 1'},{label:'额度窗口 2'}]).map(w=>({label:String(w.label||'额度窗口'),remaining:typeof w.remaining==='number'&&Number.isFinite(w.remaining)&&w.remaining>=0&&w.remaining<=100?w.remaining:null,resetsAt:Number.isFinite(w.resetsAt)&&w.resetsAt>0&&Number.isFinite(new Date(w.resetsAt*1000).getTime())?w.resetsAt:null}));
  const hasValues=rows.some(r=>r.remaining!==null);
  const messages={connecting:'正在连接额度…',unverified:'核对账户后显示额度','account-mismatch':'账户已变化，请重新确认',stale:hasValues?'更新失败，显示上次有效额度':'更新失败，暂时无法取得额度',unavailable:'暂时无法取得额度'};
  return {rows,summary:hasValues?rows.map(r=>r.label+' '+(r.remaining===null?'—':Math.round(r.remaining)+'%')).join(' · '):'额度暂未确认 · —',message:messages[health]||(usable&&hasValues?'剩余百分比 · 香港时间':'暂时无法取得额度')};
 }
 if(typeof module==='object'&&module.exports)module.exports={quotaView};else root.InoriQuotaView={quotaView};
})(globalThis);
