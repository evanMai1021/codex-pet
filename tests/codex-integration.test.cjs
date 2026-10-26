const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const integration=require('../src/inori/integration.cjs');
const server=require('../plugins/codex-pet/server/index.cjs');
const base=process.env.INORI_INTEGRATION_TEST_DIR;
test('native plugin settings declare a real open action and a boolean control',async()=>{
 const r=await server.handle({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}});
 assert.equal(r.result.serverInfo.version,require('../package.json').version);
 assert.deepEqual(r.result.capabilities.experimental['openai/settings'],{readTool:'pet_settings_read',updateTool:'pet_settings_update'});
 const list=(await server.handle({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools;
 assert.equal(list.find(t=>t.name==='pet_open_settings')._meta.ui.resourceUri,'ui://codex-pet/control-panel');
 assert.deepEqual(list.find(t=>t.name==='pet_control_panel')._meta['openai/ui'].entrypoints,[{type:'global'},{type:'thread'}]);
 const ui=await server.handle({jsonrpc:'2.0',id:3,method:'resources/read',params:{uri:'ui://codex-pet/control-panel'}});
 assert.match(ui.result.contents[0].text,/ui\/initialize/);
 assert.doesNotMatch(ui.result.contents[0].text,/pet_open_settings|>打开设置</);
 assert.match(ui.result.contents[0].text,/打开宠物/);
 assert.equal((await server.handle({jsonrpc:'2.0',id:4,method:'resources/read',params:{uri:'file:///etc/passwd'}})).error.code,-32602);
});
test('settings reads are side effect free and invalid writes never spawn or alter startup',async()=>{
 const control=require('../plugins/codex-pet/server/control-client.cjs'),before=control.settings;
 control.settings=async()=>({settings:{followCodex:false},status:{},phrases:[],skins:[]});
 const read=await server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'pet_settings_read',arguments:{}}});
 control.settings=before;
 assert.equal(typeof read.result.structuredContent.values.followCodex,'boolean');
 for(const args of [{set:{followCodex:'true'}},{set:{followCodex:true,path:'x'}},{set:{}},{set:{followCodex:true},extra:true}]){
  const r=await server.handle({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'pet_settings_update',arguments:args}});assert.equal(r.result.isError,true);
 }
});
test('isolated enable and disable only save preference without OS registration',{skip:!base},()=>{
 const oldHome=process.env.CODEX_PET_HOME;process.env.CODEX_PET_HOME=base;
 try{
  fs.mkdirSync(base,{recursive:true});const exe=path.join(base,'portable','Pet.exe');
  fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,'fixture');
  const config=path.join(base,'runtime.json'),original={inoriExecutable:exe,electron:'preserved-runtime',other:'preserved'};
  fs.writeFileSync(config,JSON.stringify(original));
  assert.equal(integration.setFollowCodex(true).followCodex,true);
  assert.equal(integration.readConfig().followMode,'plugin');
  assert.equal(integration.readConfig().other,'preserved');assert.equal(integration.readConfig().electron,original.electron);
  integration.setFollowCodex(false);
  assert.equal(integration.readConfig().followCodex,false);
  assert.throws(()=>integration.setFollowCodex('true'));
  assert.doesNotMatch(fs.readFileSync(require.resolve('../src/inori/integration.cjs'),'utf8'),/reg\.exe|pythonw|codex-watch|setInterval/);
 }finally{if(oldHome===undefined)delete process.env.CODEX_PET_HOME;else process.env.CODEX_PET_HOME=oldHome;}
});
test('plugin lifecycle starts once only when enabled and never opens settings',async()=>{
 const calls=[];
 const start=integration.createPluginStartup({read:()=>({followCodex:true}),launch:async args=>calls.push(args)});
 assert.equal((await start()).started,true);assert.equal((await start()).started,false);
 assert.deepEqual(calls,[['--codex-autostart']]);
 const disabled=integration.createPluginStartup({read:()=>({followCodex:false}),launch:()=>{throw Error('must not launch');}});
 assert.equal((await disabled()).started,false);
});
test('open pet launches and settings returns embedded UI without native launch',async()=>{
 const bridge=require('../plugins/codex-pet/server/integration.cjs'),old=bridge.launchPet,calls=[];
 const control=require('../plugins/codex-pet/server/control-client.cjs'),before=control.settings;control.settings=async()=>({settings:{},phrases:[],status:{},skins:[]});
 bridge.launchPet=async(args=[])=>{calls.push(args);return {opened:true};};
 try{
  for(const name of ['pet_open','pet_open_settings']){
   const r=await server.handle({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{}}});
   assert.ok(!r.result.isError);
  }
  assert.deepEqual(calls,[[]]);
 }finally{bridge.launchPet=old;control.settings=before;}
});
