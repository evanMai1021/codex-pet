'use strict';
window.taskBubble.onUpdate(value=>{
 for(const key of ['headline','title','label','progress','stage','action']){const el=document.getElementById(key);el.textContent=value[key]||'';if(['stage','action'].includes(key))el.hidden=!value[key];}
 // If there is no separate public summary, show the phase once, without duplication.
 document.getElementById('progress').hidden=!value.progress||value.progress===value.stage;
 document.getElementById('count').textContent=value.count>1?`${value.count} 个聊天状态`:'';
 document.getElementById('note').hidden=!value.experimental;
 document.getElementById('headline').title=(value.headline||'')+' · 点击换一句';
});
document.getElementById('headline').onclick=()=>window.taskBubble.cycle();
document.getElementById('more').onclick=()=>window.taskBubble.settings();
