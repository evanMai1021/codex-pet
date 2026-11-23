"use strict";
const $=id=>document.getElementById(id);let previewReady=false,previewBusy=false;let skinSignature='',sizeTimer,phraseGroups=[],phraseSignature='';
function showPhraseList(){
 const group=phraseGroups.find(g=>g.id===$('bubblePhraseState').value)||phraseGroups[0];
 $('bubblePhraseList').replaceChildren(...(group?.lines||[]).map(line=>{const li=document.createElement('li');li.textContent=line;return li;}));
}
function show(v){
 previewReady=true;
 document.querySelectorAll('[data-preview-skin]').forEach(el=>{const selected=el.dataset.previewSkin===v.settings.skin;el.classList.toggle('selected',selected);el.setAttribute('aria-checked',String(selected));});document.querySelectorAll('[data-preview-style]').forEach(el=>{const selected=el.dataset.previewStyle===v.settings.quotaStyle;el.classList.toggle('selected',selected);el.setAttribute('aria-checked',String(selected));});
 const signaturePhrases=JSON.stringify(v.phrases||[]);
 if(signaturePhrases!==phraseSignature){phraseSignature=signaturePhrases;phraseGroups=v.phrases||[];const selected=$('bubblePhraseState').value;$('bubblePhraseState').replaceChildren(...phraseGroups.map(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.label;return o;}));if(phraseGroups.some(g=>g.id===selected))$('bubblePhraseState').value=selected;showPhraseList();}
 $('bubbleTone').value=v.settings.bubbleTone||'cute';
 if(document.activeElement!==$('bubbleCustomLine'))$('bubbleCustomLine').value=v.settings.bubbleCustomLine||'';
 $('quotaBadgeVisible').checked=v.settings.quotaBadgeVisible!==false;
 $('quotaStyle').value=v.settings.quotaStyle||'style2';
 for(const key of ['bubblePinnedPage','bubblePosition','bubbleOffsetX','bubbleOffsetY'])if(document.activeElement!==$(key))$(key).value=v.settings[key]??(key==='bubblePinnedPage'?'off':key==='bubblePosition'?'auto':0);
 $('bubbleEnabled').checked=v.settings.bubbleEnabled!==false;
 if(document.activeElement!==$('bubbleScale')){$('bubbleScale').value=Math.round((v.settings.bubbleScale??1)*100);$('bubbleScaleValue').textContent=$('bubbleScale').value+'% · 独立于公仔大小';}
 $('followCodex').checked=v.settings.followCodex===true;
 $('dockEnabled').checked=v.settings.dockEnabled!==false;$('dock').disabled=v.settings.dockEnabled===false;
 $('visible').checked=v.settings.visible;$('reduced').checked=v.settings.reduced;$('dock').value=v.settings.dock||'';
 if(document.activeElement!==$('size')){$('size').value=Math.round(v.settings.size*100);$('sizeValue').textContent=Math.round(v.settings.size*100)+'%';}
 $('status').textContent=v.status.label||'状态未知';
 const signature=JSON.stringify(v.skins.map(s=>[s.id,s.name]));
 if(signature!==skinSignature){skinSignature=signature;$('skin').replaceChildren(...v.skins.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;return o;}));}
 lockPreviews();
 $('skin').value=v.skin.id;$('skin').disabled=v.skins.length<2;$('import').hidden=true;$('license').textContent='当前角色许可：'+v.skin.license;$('component-state').textContent=v.settings.visible?'已显示':'已隐藏';
}
function feedback(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function lockPreviews(){document.querySelectorAll('[data-preview-skin],[data-preview-style]').forEach(el=>el.setAttribute('aria-disabled',String(!previewReady||previewBusy)));}
async function change(patch){previewBusy=true;lockPreviews();try{show(await window.pet.set(patch));feedback('已保存');}catch(e){try{show(await window.pet.get());}catch{}feedback(e.message,true);}finally{previewBusy=false;lockPreviews();}}
for(const id of ['visible','reduced','dockEnabled','followCodex','bubbleEnabled','quotaBadgeVisible'])$(id).onchange=()=>change({[id]:$(id).checked});
$('bubbleScale').oninput=()=>{$('bubbleScaleValue').textContent=$('bubbleScale').value+'% · 独立于公仔大小';};
$('bubbleScale').onchange=()=>change({bubbleScale:Number($('bubbleScale').value)/100});
$('bubblePinnedPage').onchange=()=>change({bubblePinnedPage:$('bubblePinnedPage').value});
$('bubblePosition').onchange=()=>change({bubblePosition:$('bubblePosition').value});
for(const key of ['bubbleOffsetX','bubbleOffsetY'])$(key).onchange=()=>change({[key]:$(key).value.trim()===''?NaN:Number($(key).value)});
$('resetBubblePosition').onclick=()=>change({bubblePosition:'auto',bubbleOffsetX:0,bubbleOffsetY:0});
$('bubbleTone').onchange=()=>change({bubbleTone:$('bubbleTone').value});
$('bubblePhraseState').onchange=showPhraseList;
$('bubbleCustomLine').onchange=()=>change({bubbleCustomLine:$('bubbleCustomLine').value});
$('dock').onchange=()=>change({dock:$('dock').value||null});$('skin').onchange=()=>change({skin:$('skin').value});
$('size').oninput=()=>{$('sizeValue').textContent=$('size').value+'%';clearTimeout(sizeTimer);const size=Number($('size').value)/100;sizeTimer=setTimeout(()=>change({size}),80);};
$('size').onchange=()=>{clearTimeout(sizeTimer);change({size:Number($('size').value)/100});};
$('import').onclick=async()=>{$('import').disabled=true;try{const v=await window.pet.importSkin();if(!v.cancelled)show(v);feedback(v.cancelled?'已取消导入':'已导入并切换公仔');}catch(e){feedback(e.message,true);}finally{$('import').disabled=false;}};
window.pet.get().then(show).catch(e=>feedback(e.message,true));window.pet.onUpdate(show);

$('quotaStyle').onchange=()=>change({quotaStyle:$('quotaStyle').value});

for(const [attr,key] of [['skin','skin'],['style','quotaStyle']]){
 const cards=[...document.querySelectorAll('[data-preview-'+attr+']')];
 cards.forEach((el,index)=>{
  const choose=()=>{if(el.getAttribute('aria-disabled')!=='true')change({[key]:el.getAttribute('data-preview-'+attr)});};
  el.onclick=choose;
  el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const next=cards[(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+cards.length)%cards.length];next.focus();next.click();}};
 });
}

$('quitPet').onclick=async()=>{previewBusy=true;lockPreviews();$('quitPet').disabled=true;try{await window.pet.quit();feedback('正在退出宠物及后台…');}catch(e){previewBusy=false;lockPreviews();$('quitPet').disabled=false;feedback(e.message,true);}};
