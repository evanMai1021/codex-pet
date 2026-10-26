'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('last plugin connection signals release; caller must independently verify host exit',()=>{
 const {createPluginLeaseWatch}=require('../src/inori/desktop-exit.cjs');
 let exits=0,enabled=true;const watch=createPluginLeaseWatch(()=>enabled,()=>exits++);
 watch({action:'attach',pid:100});watch({action:'attach',pid:200});
 watch({action:'release',pid:100});assert.equal(exits,0);
 watch({action:'release',pid:200});assert.equal(exits,1);
 watch({action:'release',pid:200});assert.equal(exits,1);
 enabled=false;watch({action:'attach',pid:300});watch({action:'release',pid:300});assert.equal(exits,1);
 assert.throws(()=>watch({action:'release',pid:0}));
});
