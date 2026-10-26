"use strict";
const $=id=>document.getElementById(id);let skinSignature='',sizeTimer,phraseGroups=[],phraseSignature='';
function showPhraseList(){
 const group=phraseGroups.find(g=>g.id===$('bubblePhraseState').value)||phraseGroups[0];
 $('bubblePhraseList').replaceChildren(...(group?.lines||[]).map(line=>{const li=document.createElement('li');li.textContent=line;return li;}));
}
function show(v){
 const signaturePhrases=JSON.stringify(v.phrases||[]);
 if(signaturePhrases!==phraseSignature){phraseSignature=signaturePhrases;phraseGroups=v.phrases||[];const selected=$('bubblePhraseState').value;$('bubblePhraseState').replaceChildren(...phraseGroups.map(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.label;return o;}));if(phraseGroups.some(g=>g.id===selected))$('bubblePhraseState').value=selected;showPhraseList();}
 $('bubbleTone').value=v.settings.bubbleTone||'cute';
 if(document.activeElement!==$('bubbleCustomLine'))$('bubbleCustomLine').value=v.settings.bubbleCustomLine||'';
 $('bubbleEnabled').checked=v.settings.bubbleEnabled!==false;
 if(document.activeElement!==$('bubbleScale')){$('bubbleScale').value=Math.round((v.settings.bubbleScale??1)*100);$('bubbleScaleValue').textContent=$('bubbleScale').value+'% · 独立于公仔大小';}
 $('followCodex').checked=v.settings.followCodex===true;
 $('dockEnabled').checked=v.settings.dockEnabled!==false;$('dock').disabled=v.settings.dockEnabled===false;
 $('visible').checked=v.settings.visible;$('reduced').checked=v.settings.reduced;$('dock').value=v.settings.dock||'';
 if(document.activeElement!==$('size')){$('size').value=Math.round(v.settings.size*100);$('sizeValue').textContent=Math.round(v.settings.size*100)+'%';}
 $('status').textContent=v.status.label||'状态未知';
 const signature=JSON.stringify(v.skins.map(s=>[s.id,s.name]));
 if(signature!==skinSignature){skinSignature=signature;$('skin').replaceChildren(...v.skins.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;return o;}));}
 $('skin').value=v.skin.id;$('skin').disabled=v.skins.length<2;$('import').hidden=true;$('license').textContent='当前角色许可：'+v.skin.license;$('component-state').textContent=v.settings.visible?'已显示':'已隐藏';
}
function feedback(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function change(patch){try{show(await window.pet.set(patch));feedback('已保存');}catch(e){try{show(await window.pet.get());}catch{}feedback(e.message,true);}}
for(const id of ['visible','reduced','dockEnabled','followCodex','bubbleEnabled'])$(id).onchange=()=>change({[id]:$(id).checked});
$('bubbleScale').oninput=()=>{$('bubbleScaleValue').textContent=$('bubbleScale').value+'% · 独立于公仔大小';};
$('bubbleScale').onchange=()=>change({bubbleScale:Number($('bubbleScale').value)/100});
$('bubbleTone').onchange=()=>change({bubbleTone:$('bubbleTone').value});
$('bubblePhraseState').onchange=showPhraseList;
$('bubbleCustomLine').onchange=()=>change({bubbleCustomLine:$('bubbleCustomLine').value});
$('dock').onchange=()=>change({dock:$('dock').value||null});$('skin').onchange=()=>change({skin:$('skin').value});
$('size').oninput=()=>{$('sizeValue').textContent=$('size').value+'%';clearTimeout(sizeTimer);const size=Number($('size').value)/100;sizeTimer=setTimeout(()=>change({size}),80);};
$('size').onchange=()=>{clearTimeout(sizeTimer);change({size:Number($('size').value)/100});};
$('import').onclick=async()=>{$('import').disabled=true;try{const v=await window.pet.importSkin();if(!v.cancelled)show(v);feedback(v.cancelled?'已取消导入':'已导入并切换公仔');}catch(e){feedback(e.message,true);}finally{$('import').disabled=false;}};
window.pet.get().then(show).catch(e=>feedback(e.message,true));window.pet.onUpdate(show);
