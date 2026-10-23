'use strict';
const SKINS=Object.freeze([
 Object.freeze({id:'redwhite',name:'楪祈 · 红白服',license:'项目默认素材，许可说明见 ASSETS.md'}),
 Object.freeze({id:'battle',name:'楪祈 · 红黑战斗服',license:'项目战斗服素材，许可说明见 ASSETS.md'})
]);
function normalizeSkin(id){return SKINS.some(s=>s.id===id)?id:'redwhite';}
module.exports={SKINS,normalizeSkin};
