// Inori adaptation of codex-on-desk. Original MIT notice retained in LICENSE.
'use strict';
const PRIORITY = {waiting: 70, error: 60, working: 50, unknown: 40, interrupted: 30, completed: 20, idle: 10};
const ROWS = {idle:[0,6,180],right:[1,8,120],left:[2,8,120],wave:[3,4,180],jump:[4,5,160],error:[5,8,160],waiting:[6,6,180],working:[7,6,150],review:[8,6,180]};
function aggregate(threads, healthy=true, now=Date.now()) {
  if (!healthy) return {state:'unknown',label:'状态源未连接',threads:[]};
  if (!threads.length) return {state:'idle',label:'已连接 · 暂无活动',threads:[]};
  // Ended interruptions are a short notice, not perpetual activity. Keep the
  // original row as evidence; only the aggregate presentation expires.
  const sorted=threads.map(row=>{
    const ended=row.terminalAt;
    const expired=row.state==='interrupted' && Number.isFinite(ended) && ended>0 && now-ended>5000;
    return {row,state:expired?'idle':row.state,label:expired?'待机':row.label};
  }).sort((a,b)=>(PRIORITY[b.state]??40)-(PRIORITY[a.state]??40) || (b.row.updatedAt??0)-(a.row.updatedAt??0));
  const selected=sorted[0];
  return {...selected.row,state:selected.state,label:selected.label,threads:sorted.map(value=>value.row)};
}
function clamp(n,min,max) {return Math.max(min,Math.min(n,max));}
function bounded(rect,area) {
  return {x:Math.round(clamp(rect.x,area.x,area.x+Math.max(0,area.width-rect.width))),y:Math.round(clamp(rect.y,area.y,area.y+Math.max(0,area.height-rect.height))),width:Math.min(rect.width,area.width),height:Math.min(rect.height,area.height)};
}
// Only painted/interactable content must stay in the work area. Transparent
// window margins can extend outside it without blocking free placement.
function visibleBounds(rect,area,regions,scale=1) {
 const content=regions.filter(r=>r.width>0&&r.height>0);
 if(!content.length)return bounded(rect,area);
 const left=Math.min(...content.map(r=>r.x))*scale,top=Math.min(...content.map(r=>r.y))*scale;
 const right=Math.max(...content.map(r=>r.x+r.width))*scale,bottom=Math.max(...content.map(r=>r.y+r.height))*scale;
 return {...rect,x:Math.round(clamp(rect.x,area.x-left,Math.max(area.x-left,area.x+area.width-right))),y:Math.round(clamp(rect.y,area.y-top,Math.max(area.y-top,area.y+area.height-bottom)))};
}
function chooseEdge(rect,area,threshold=24) {
  const edges=[['left',Math.abs(rect.x-area.x)],['right',Math.abs(area.x+area.width-rect.x-rect.width)],['top',Math.abs(rect.y-area.y)],['bottom',Math.abs(area.y+area.height-rect.y-rect.height)]];
  edges.sort((a,b)=>a[1]-b[1]);return edges[0][1]<=threshold?edges[0][0]:null;
}
// A normal grab can push part of the character beyond the work-area edge.
function chooseDropEdge(rect,area,cursor,threshold=24,preferredEdge=null){
 const candidates=[['left',rect.x-area.x,Math.abs(cursor.x-area.x)],['right',area.x+area.width-rect.x-rect.width,Math.abs(area.x+area.width-cursor.x)],['top',rect.y-area.y,Math.abs(cursor.y-area.y)],['bottom',area.y+area.height-rect.y-rect.height,Math.abs(area.y+area.height-cursor.y)]];
 const eligible=candidates.filter(([edge,d])=>d<=threshold&&(['left','right'].includes(edge)?rect.y+rect.height>area.y&&rect.y<area.y+area.height:rect.x+rect.width>area.x&&rect.x<area.x+area.width));
 if(eligible.some(([edge])=>edge===preferredEdge))return preferredEdge;
 eligible.sort((a,b)=>a[2]-b[2]);return eligible[0]?.[0]??null;
}
function dockBounds(rect,area,edge,regions=[],scale=1) {
  // Keep the chosen edge anchor; clamp visible content along the edge.
  let r=regions.length?visibleBounds(rect,area,regions,scale):bounded(rect,area);
  if(edge==='left')r.x=area.x;
  if(edge==='right')r.x=area.x+area.width-r.width;
  if(edge==='top')r.y=area.y;
  if(edge==='bottom')r.y=area.y+area.height-r.height;
  return r;
}
function remaining(window) {
  return window && typeof window.usedPercent==='number' && Number.isFinite(window.usedPercent) ? clamp(100-window.usedPercent,0,100):null;
}
function windowLabel(minutes) {
  if(!Number.isFinite(minutes)||minutes<=0)return '额度窗口';
  if(minutes===10080)return '每周';
  if(minutes%60===0)return `${minutes/60}小时`;
  return `${minutes}分钟`;
}
function quotaFailure(previous,expectedFingerprint){
  if(previous.health==='account-mismatch')return {...previous,windows:[]};
  const verified=!!expectedFingerprint&&previous.fingerprint===expectedFingerprint;
  if(verified&&previous.windows?.length)return {...previous,health:'stale'};
  return {...previous,health:previous.fingerprint?'unverified':'unavailable'};
}
function normalizeQuota(response,now=Date.now()) {
  const buckets=response.rateLimitsByLimitId??{codex:response.rateLimits};
  const bucket=buckets.codex??Object.values(buckets).find(Boolean);
  if(!bucket)return {health:'unavailable',windows:[],updatedAt:null};
  const windows=['primary','secondary'].flatMap(key=>{
    const w=bucket[key]; const percent=remaining(w);
    return w&&percent!==null?[{key,label:windowLabel(w.windowDurationMins),remaining:percent,resetsAt:w.resetsAt??null}]:[];
  });
  return {health:windows.length?'ok':'unavailable',windows,updatedAt:now};
}
function idleAnimation(state,idleMs) {
  if(state!=='idle')return state;
  if(idleMs>=300000)return 'sleep';
  if(idleMs>=120000)return 'doze';
  if(idleMs>=60000&&idleMs<63000)return 'stretch';
  return 'idle';
}
module.exports={PRIORITY,ROWS,aggregate,bounded,visibleBounds,chooseEdge,chooseDropEdge,dockBounds,remaining,windowLabel,normalizeQuota,quotaFailure,idleAnimation};
