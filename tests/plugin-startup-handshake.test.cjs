'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('automatic pet launch begins with initialize and is not delayed or duplicated by initialized notification',async()=>{
 const integration=require('../plugins/codex-pet/server/integration.cjs'),control=require('../plugins/codex-pet/server/control-client.cjs');
 const original=integration.createPluginStartup,previous=control.lifecycle;let launches=0;
 integration.createPluginStartup=()=>original({read:()=>({followCodex:true}),launch:async()=>{launches++;}});
 control.lifecycle=async()=>({connected:1});
 try{
  const file=require.resolve('../plugins/codex-pet/server/index.cjs');delete require.cache[file];const api=require(file);
  const initialized=await api.handle({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}});
  assert.equal(initialized.result.serverInfo.version,'0.1.15');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(launches,1,'host may delay initialized while setting up other plugins');
  await api.handle({jsonrpc:'2.0',method:'notifications/initialized'});assert.equal(launches,1);
 }finally{integration.createPluginStartup=original;control.lifecycle=previous;}
});
