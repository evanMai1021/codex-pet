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
 const q=data.quota||{},view=InoriQuotaView.quotaView(q);$('quota-windows').replaceChildren();
 const compact=data.quotaStyle==='style1';$('quota-details').hidden=compact;const summary=$('quota-summary');summary.hidden=!compact;summary.classList.toggle('quota-summary-cards',compact);summary.replaceChildren();
 const resetBlock=w=>{const block=document.createElement('div');block.className='quota-reset';const label=document.createElement('span');label.textContent='下次重置';const time=document.createElement('time');time.textContent=w.resetsAt?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(w.resetsAt*1000):'时间待更新';if(w.resetsAt){time.dateTime=new Date(w.resetsAt*1000).toISOString();time.title='香港时间 · '+time.textContent;}block.append(label,time);return block;};
 if(compact){for(const w of view.rows){const card=document.createElement('section');card.className='quota-summary-card';card.dataset.level=w.remaining===null?'unknown':w.remaining<=20?'low':w.remaining<=40?'watch':'normal';const label=document.createElement('span');label.className='quota-summary-label';label.textContent=w.label+'剩余';const value=document.createElement('strong');value.textContent=w.remaining===null?'—':Math.round(w.remaining)+'%';const bar=document.createElement('div');bar.className='quota-summary-bar';if(w.remaining!==null){const fill=document.createElement('span');fill.style.width=w.remaining+'%';bar.append(fill);}else bar.dataset.unknown='true';card.append(label,value,bar,resetBlock(w));summary.append(card);}}
 for(const w of view.rows){const box=document.createElement('section');box.className='quota-row';const heading=document.createElement('div');heading.className='quota-title';const label=document.createElement('span');label.textContent=w.label+'剩余';const value=document.createElement('strong');value.textContent=w.remaining===null?'—':Math.round(w.remaining)+'%';heading.append(label,value);const bar=document.createElement('div');bar.className='bar';if(w.remaining===null)bar.dataset.unknown='true';const fill=document.createElement('span');fill.style.width=(w.remaining===null?0:w.remaining)+'%';bar.append(fill);box.append(heading,bar,resetBlock(w));$('quota-windows').append(box);}
 $('quota-health').textContent=view.message;
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
