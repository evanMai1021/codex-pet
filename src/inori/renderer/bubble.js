'use strict';
const $=id=>document.getElementById(id),pages=['task','quota','usage'];let data={},optionKey='';
const number=n=>new Intl.NumberFormat('zh-CN').format(n),millions=n=>'≈ '+(n/1e6).toFixed(n>0&&n<10000?6:2).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1')+' M';
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
function amount(id,value,ready,empty='暂不可用'){ $(id+'-million').textContent=ready?millions(value):empty;$(id+'-total').textContent=ready?number(value):''; }
function render(){
 const page=pages.includes(data.page)?data.page:'task';document.querySelector('main').dataset.state=data.state||'unknown';
 $('label').textContent=page==='task'?data.label:page==='quota'?'剩余额度':'今日用量';$('count').textContent=page==='task'&&data.count>1?data.count+' 个聊天':'';
 for(const name of pages)$('page-'+name).hidden=name!==page;
 for(const tab of document.querySelectorAll('[data-page]')){tab.setAttribute('aria-selected',String(tab.dataset.page===page));tab.tabIndex=tab.dataset.page===page?0:-1;}
 for(const key of ['headline','title','progress','stage','action']){$(key).textContent=data[key]||'';if(['stage','action'].includes(key))$(key).hidden=!data[key];}
 $('progress').hidden=!data.progress||data.progress===data.stage;$('note').hidden=!data.experimental;
 const threads=data.threadUsage?.threads||[],selected=data.selectedThreadId||'',current=data.currentThreadId||threads[0]?.threadId;
 const key=JSON.stringify([threads.map(t=>[t.threadId,t.title]),!!data.currentThreadId,selected]);
 if(key!==optionKey){optionKey=key;const auto=document.createElement('option');auto.value='';auto.textContent=data.currentThreadId?'当前任务聊天':'最近更新的聊天';$('thread').replaceChildren(auto,...threads.map(t=>{const o=document.createElement('option');o.value=t.threadId;o.textContent=String(t.title||'未命名聊天').slice(0,48);return o;}));if(selected&&!threads.some(t=>t.threadId===selected)){const o=document.createElement('option');o.value=selected;o.textContent='之前选择的聊天（待更新）';$('thread').append(o);}$('thread').value=selected;}
 const row=threads.find(t=>t.threadId===(selected||current)),ready=data.threadUsage?.health==='ready'&&row?.health==='ready'&&valid(row?.totalTokens);
 $('thread').title=row?.title||'';amount('chat',row?.totalTokens,ready,data.threadUsage?.health==='unavailable'?'暂不可用':'暂无用量记录');$('chat-health').textContent=selected?'所选聊天累计':data.currentThreadId?'当前聊天累计':'最近聊天累计';
 const q=data.quota||{},windows=['ok','stale','preview'].includes(q.health)?q.windows||[]:[];$('quota-windows').replaceChildren();
 for(const w of windows){const box=document.createElement('section');box.className='quota-row';const heading=document.createElement('div');heading.className='quota-title';const label=document.createElement('span');label.textContent=w.label+'剩余';const value=document.createElement('strong');value.textContent=Math.round(w.remaining)+'%';heading.append(label,value);const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('span');fill.style.width=Math.max(0,Math.min(100,w.remaining))+'%';bar.append(fill);const reset=document.createElement('small');reset.textContent=w.resetsAt?'重置 '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(w.resetsAt*1000):'重置时间未知';box.append(heading,bar,reset);$('quota-windows').append(box);}
 $('quota-health').textContent=q.health==='stale'?'更新失败，显示上次额度':windows.length?'剩余百分比 · 香港时间':q.health==='unverified'?'核对账户后显示额度':q.health==='account-mismatch'?'账户已变化，请重新确认':'暂时无法取得额度';
 $('account').textContent=q.accountLabel?'账户：'+q.accountLabel:'';$('confirm').hidden=!q.fingerprint||!['unverified','account-mismatch'].includes(q.health);
 const u=data.dailyUsage||{},usageReady=['ready','partial'].includes(u.health)&&valid(u.totalTokens);amount('today',u.totalTokens,usageReady,u.health==='empty'?'暂无今日记录':u.health==='unavailable'?'暂不可用':'正在统计…');$('breakdown').replaceChildren();
 if(usageReady)for(const [label,value] of [['输入',u.inputTokens],['输出',u.outputTokens],['其中缓存输入',u.cachedInputTokens]]){const row=document.createElement('div');row.className='token-row';const title=document.createElement('span');title.textContent=label;const n=document.createElement('strong');n.textContent=valid(value)?millions(value):'—';const m=document.createElement('small');m.textContent=valid(value)?number(value):'';n.append(m);row.append(title,n);$('breakdown').append(row);}
 $('usage-date').textContent=(u.date?u.date+' · ':'')+'香港时间'+(u.health==='partial'?' · 统计尚未完整':'');
}
window.taskBubble.onUpdate(value=>{data=value;render();});
for(const tab of document.querySelectorAll('[data-page]'))tab.onclick=()=>window.taskBubble.page(tab.dataset.page);
function step(n){const i=pages.indexOf(data.page||'task');window.taskBubble.page(pages[(i+n+pages.length)%pages.length]);}
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('headline').onclick=()=>window.taskBubble.cycle();$('dismiss').onclick=()=>window.taskBubble.dismiss();$('thread').onchange=()=>window.taskBubble.thread($('thread').value);$('refresh').onclick=()=>window.taskBubble.refresh();$('confirm').onclick=()=>window.taskBubble.confirm();
document.querySelector('[role=tablist]').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}};
