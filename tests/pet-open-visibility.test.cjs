'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('open acknowledges actual visible runtime instead of only spawning a process',async()=>{
 const integration=require('../plugins/codex-pet/server/integration.cjs'),control=require('../plugins/codex-pet/server/control-client.cjs');
 const originals={launch:integration.launchPet,settings:control.settings,lifecycle:control.lifecycle};let visible=false,launches=0;
 integration.launchPet=async()=>{launches++;return {opened:true};};
 control.settings=async patch=>{if(patch&&'visible'in patch)visible=patch.visible;return {settings:{visible},status:{},phrases:[],skins:[]};};
 control.lifecycle=async()=>({connected:1});
 try{const file=require.resolve('../plugins/codex-pet/server/index.cjs');delete require.cache[file];const api=require(file);
  const response=await api.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pet_open',arguments:{}}});
  assert.equal(response.result.isError,undefined);assert.equal(visible,true,'open must explicitly show the existing hidden instance');assert.equal(launches,0,'a connected runtime does not need a second process');
 }finally{integration.launchPet=originals.launch;control.settings=originals.settings;control.lifecycle=originals.lifecycle;}
});
