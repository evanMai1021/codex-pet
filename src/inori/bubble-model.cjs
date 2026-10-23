'use strict';
function clean(value,max=120){return String(value??'').replace(/sk-[A-Za-z0-9_-]{12,}/g,'[已隐藏]').replace(/\s+/g,' ').slice(0,max);}
const PHRASES={
 cute:{working:['正在认真想下一步呢～','小脑袋转呀转，陪我一下嘛♡','这一步也要仔细做好呀 ฅ•ω•ฅ'],waiting:['我在这里等你回应呀～','需要你来帮我一下下♡'],error:['遇到小绊脚石啦，一起看看嘛～','这里卡住一点点，需要看看呀～'],completed:['这一轮做好啦，来看看呀♡','这轮任务结束啦，陪我看看成果～'],interrupted:['先乖乖停下来，等你安排～','收到啦，先停在这里等你♡'],unknown:['信号有点迷糊，我先不乱猜～','还没看清状态，再等等呀～']},
 affectionate:{working:['陪我把这一步做好嘛♡','我在努力干活，等我一下下～','让我再仔细看看，好不好呀♡'],waiting:['这里要你点点头才可以呀♡','还在等你呢，来看看我嘛～'],error:['卡住一点点啦，陪我看看好不好～','碰到小难题啦，需要你看看嘛♡'],completed:['这轮做完啦，可以看看我嘛♡','这一轮结束啦，来陪我看看成果嘛～'],interrupted:['听你的，先停在这里啦～','我先乖乖停下，等你再安排♡'],unknown:['我还没看清状态，陪我等等嘛～','状态还不清楚，再陪我等一下呀♡']},
 simple:{working:['正在处理当前任务','正在核对下一步'],waiting:['等待你的操作','请查看 Codex 提示'],error:['任务需要检查','请查看错误提示'],completed:['本轮已完成','可以查看本轮结果'],interrupted:['本轮已中断','等待后续安排'],unknown:['状态暂不可确认','等待状态更新']}
};
function normalizeBubbleTone(tone){return tone==='simple'?'simple':'cute';}
function phraseLines(model,options={}){
 const tone=normalizeBubbleTone(options.bubbleTone),state=Object.hasOwn(PHRASES.cute,model.state)?model.state:'unknown';
 let lines=tone==='simple'?PHRASES.simple[state]:[...PHRASES.cute[state],...PHRASES.affectionate[state]];
 // Input-only waits must never imply that approval is required.
 if(state==='waiting'&&!model.approval&&tone==='cute')lines=[...PHRASES.cute.waiting,'等你告诉我下一步呢♡','我在这里等你回应，好不好呀～'];
 const custom=clean(options.bubbleCustomLine,56).trim();if(custom)lines=[...lines,custom];
 return [...new Set(lines)];
}
function bubblePhraseGroups(options={}){
 return [['working','任务进行中'],['approval','等待批准'],['input','等待回答或操作'],['completed','本轮完成'],['interrupted','本轮中断'],['error','任务出错'],['unknown','状态未知']].map(([id,label])=>({id,label,lines:phraseLines({state:['approval','input'].includes(id)?'waiting':id,approval:id==='approval'},options)}));
}
function bubbleHeadline(model,options={},index=0){
 const lines=phraseLines(model,options);
 return lines[Math.max(0,index)%lines.length];
}
function taskBubble(snapshot){
 const status=snapshot?.status??{},state=status.state,threads=status.threads??[];
 if(!['working','waiting','error','completed','interrupted','unknown'].includes(state))return {visible:false};
 if(state==='unknown'&&!status.threadId)return {visible:false};
 const approval=state==='waiting'&&status.approvalPending===true;
 const labels={working:'任务进行中',waiting:approval?'需要你批准':'需要你操作',error:'任务出错',completed:'本轮已完成',interrupted:'本轮已中断',unknown:'状态暂不可确认'};
 return {visible:true,state,title:clean(status.title||'未命名任务',80),label:labels[state],
  stage:state==='working'?clean(status.phase||'正在处理任务',40):'',
  progress:state==='working'?clean(status.publicProgress||status.phase||'正在处理任务',120):state==='waiting'?'':clean(status.label||labels[state]),
  action:state==='waiting'?(approval?'请到 Codex 查看并决定是否批准':'请到 Codex 查看需要回答或处理的提示'):'',
  count:threads.length,approval,experimental:approval&&status.statusSource==='desktop-ipc-experimental'};
}
function placeBubble(anchor,area,width=276,height=136){
 const gap=10;
 let x=anchor.x+anchor.width+gap,y=anchor.y+(anchor.height-height)/2;
 if(x+width>area.x+area.width)x=anchor.x-width-gap;
 if(x<area.x){x=anchor.x+(anchor.width-width)/2;y=anchor.y-height-gap;if(y<area.y)y=anchor.y+anchor.height+gap;}
 return {x:Math.round(Math.max(area.x,Math.min(x,area.x+Math.max(0,area.width-width)))),y:Math.round(Math.max(area.y,Math.min(y,area.y+Math.max(0,area.height-height)))),width:Math.min(width,area.width),height:Math.min(height,area.height)};
}
module.exports={taskBubble,placeBubble,bubbleHeadline,bubblePhraseGroups,normalizeBubbleTone};
