"use strict";
const $=id=>document.getElementById(id);let skinSignature='',sizeTimer;
function show(v){
 $('dockEnabled').checked=v.settings.dockEnabled!==false;$('dock').disabled=v.settings.dockEnabled===false;
 $('visible').checked=v.settings.visible;$('reduced').checked=v.settings.reduced;$('dock').value=v.settings.dock||'';
 if(document.activeElement!==$('size')){$('size').value=Math.round(v.settings.size*100);$('sizeValue').textContent=Math.round(v.settings.size*100)+'%';}
 $('status').textContent=v.status.label||'状态未知';
 const signature=JSON.stringify(v.skins.map(s=>[s.id,s.name]));
 if(signature!==skinSignature){skinSignature=signature;$('skin').replaceChildren(...v.skins.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;return o;}));}
 $('skin').value=v.skin.id;$('skin').disabled=true;$('import').hidden=true;$('license').textContent='当前角色许可：'+v.skin.license;$('component-state').textContent=v.settings.visible?'已显示':'已隐藏';
}
function feedback(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function change(patch){try{show(await window.pet.set(patch));feedback('已保存');}catch(e){feedback(e.message,true);}}
for(const id of ['visible','reduced','dockEnabled'])$(id).onchange=()=>change({[id]:$(id).checked});
$('dock').onchange=()=>change({dock:$('dock').value||null});$('skin').onchange=()=>change({skin:$('skin').value});
$('size').oninput=()=>{$('sizeValue').textContent=$('size').value+'%';clearTimeout(sizeTimer);const size=Number($('size').value)/100;sizeTimer=setTimeout(()=>change({size}),80);};
$('size').onchange=()=>{clearTimeout(sizeTimer);change({size:Number($('size').value)/100});};
$('import').onclick=async()=>{$('import').disabled=true;try{const v=await window.pet.importSkin();if(!v.cancelled)show(v);feedback(v.cancelled?'已取消导入':'已导入并切换公仔');}catch(e){feedback(e.message,true);}finally{$('import').disabled=false;}};
window.pet.get().then(show).catch(e=>feedback(e.message,true));window.pet.onUpdate(show);
