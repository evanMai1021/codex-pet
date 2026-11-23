'use strict';
const properties={
 visible:{type:'boolean',title:'显示桌面公仔'},
 followCodex:{type:'boolean',title:'随 Codex 启动',description:'随插件加载启动，完全退出 Codex 后结束；不添加开机启动项。'},
 skin:{type:'string',enum:['redwhite','battle'],title:'公仔服装',oneOf:[{const:'redwhite',title:'红白服'},{const:'battle',title:'红黑战斗服'}]},
 size:{type:'number',enum:[.8,1,1.2],title:'角色大小'},
 reduced:{type:'boolean',title:'减少动态效果'},
 dockEnabled:{type:'boolean',title:'允许趴边'},
 dock:{type:['string','null'],enum:[null,'left','right','top','bottom'],title:'停靠位置'},
 bubblePinnedPage:{type:'string',enum:['off','task','quota','usage'],title:'气泡常驻内容',description:'空闲时显示所选页面，任务时自动切到任务页，任务结束后切回；关闭气泡会同时关闭常驻。',oneOf:[{const:'off',title:'不常驻'},{const:'task',title:'任务状态'},{const:'quota',title:'剩余额度'},{const:'usage',title:'今日用量'}]},
 bubbleEnabled:{type:'boolean',title:'自动显示任务气泡'},
 quotaBadgeVisible:{type:'boolean',title:'显示公仔下方额度条',description:'仅控制公仔下方提示条，开启后可点击查看额度。'},
 quotaStyle:{type:'string',enum:['style1','style2'],title:'额度详情样式',oneOf:[{const:'style1',title:'样式1 · 双列卡片'},{const:'style2',title:'样式2 · 纵向详情'}]},
 bubblePosition:{type:'string',enum:['auto','left','right','top','bottom'],title:'气泡位置',oneOf:[{const:'auto',title:'自动避让'},{const:'left',title:'公仔左侧'},{const:'right',title:'公仔右侧'},{const:'top',title:'公仔上方'},{const:'bottom',title:'公仔下方'}]},
 bubbleOffsetX:{type:'number',minimum:-400,maximum:400,title:'气泡水平微调',description:'负数向左，正数向右；靠近边缘或遮挡公仔时自动避让。'},
 bubbleOffsetY:{type:'number',minimum:-400,maximum:400,title:'气泡垂直微调',description:'负数向上，正数向下；任务、额度和用量页面共用。'},
 bubbleScale:{type:'number',enum:[.8,1,1.2,1.4],title:'气泡大小',description:'统一调整任务、额度和今日用量页面，不改变公仔大小。'},
 bubbleTone:{type:'string',enum:['cute','simple'],title:'气泡语气',oneOf:[{const:'cute',title:'可爱 · 撒娇'},{const:'simple',title:'简洁'}]},
 bubbleCustomLine:{type:'string',maxLength:56,title:'我的气泡短句'}
};
function validatePatch(input,current={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length)throw Error('请选择需要修改的设置');
 const patch={...input};
 for(const [key,value] of Object.entries(patch)){
  const spec=properties[key];if(!spec)throw Error('不支持的设置：'+key);
  if(key==='bubbleTone'&&value==='affectionate'){patch[key]='cute';continue;}
  if(spec.enum){if(!spec.enum.includes(value))throw Error('设置值无效：'+key);}
  else if(typeof value!==spec.type)throw Error('设置类型无效：'+key);
  if(spec.type==='number'&&(!Number.isFinite(value)||(spec.minimum!==undefined&&value<spec.minimum)||(spec.maximum!==undefined&&value>spec.maximum)))throw Error('设置范围无效：'+key);
  if(spec.maxLength&&value.length>spec.maxLength)throw Error('自定义短句最多56个字符');
 }
 if('bubbleCustomLine'in patch)patch.bubbleCustomLine=patch.bubbleCustomLine.trim();
 if(patch.dock&&(patch.dockEnabled??current.dockEnabled)===false)throw Error('请先打开允许趴边开关');
 return patch;
}
module.exports={properties,validatePatch};
