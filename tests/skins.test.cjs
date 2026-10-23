const test=require('node:test'),assert=require('node:assert/strict');
const {SKINS,normalizeSkin}=require('../src/inori/skins.cjs');
test('outfit identifiers are stable and unique',()=>assert.deepEqual(SKINS.map(s=>s.id),['redwhite','battle']));
test('older profiles and invalid identifiers keep the original redwhite outfit',()=>{for(const id of [undefined,null,'inori','../battle','__proto__'])assert.equal(normalizeSkin(id),'redwhite');});
test('battle is retained when selected',()=>assert.equal(normalizeSkin('battle'),'battle'));
