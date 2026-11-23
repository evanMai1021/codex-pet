'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
test('explicit pet exit suppresses automatic startup even when follow-Codex stays enabled',async()=>{
 const api=require('../plugins/codex-pet/server/integration.cjs');let launches=0;
 const start=api.createPluginStartup({read:()=>({followCodex:true,petStopped:true}),launch:async()=>{launches++;}});
 await start();assert.equal(launches,0,'manual exit must not be undone by plugin initialize/reconnect');
});
test('an exited runtime is not launched by background/settings/update callers',async()=>{
 const integration=require('../plugins/codex-pet/server/integration.cjs');let launched=false;
 const result=await integration.launchPet([], {read:()=>({petStopped:true}),spawn:()=>{launched=true;throw Error('unexpected launch');}});
 assert.equal(launched,false);assert.equal(result.stopped,true);
});
test('a new Codex session restores follow-start without changing the preference',async()=>{
 const api=require('../plugins/codex-pet/server/integration.cjs');let launches=0,stopped=true;
 const start=api.createPluginStartup({read:()=>({followCodex:true,petStopped:stopped,petStoppedSession:['100:old']}),session:()=>['200:new'],setStopped:v=>{stopped=v;},launch:async()=>{launches++;}});
 await start();assert.equal(launches,1,'a genuine new host session must resume follow-start');assert.equal(stopped,false);
});
test('same-session plugin reload, unknown host and disabled follow-start never resume',async()=>{
 const api=require('../plugins/codex-pet/server/integration.cjs');
 for(const [followCodex,session] of [[true,['100:old']],[true,null],[true,[]],[true,['100:old','200:new']],[false,['200:new']]]){
  let launches=0;const start=api.createPluginStartup({read:()=>({followCodex,petStopped:true,petStoppedSession:['100:old']}),session:()=>session,setStopped:()=>{},launch:async()=>{launches++;}});
  await start();assert.equal(launches,0,JSON.stringify({followCodex,session}));
 }
});
test('PID reuse counts as a new session, but a live old host does not',async()=>{
 const api=require('../plugins/codex-pet/server/integration.cjs');let launches=0;
 const start=api.createPluginStartup({read:()=>({followCodex:true,petStopped:true,petStoppedSession:['100:old-start']}),session:()=>['100:new-start'],setStopped:()=>{},launch:async()=>{launches++;}});
 await start();assert.equal(launches,1);
});
test('settings polling after exit stays offline and only explicit open resumes',async()=>{
 const fs=require('node:fs'),path=require('node:path');
 const integration=require('../plugins/codex-pet/server/integration.cjs'),control=require('../plugins/codex-pet/server/control-client.cjs');
 const previous={read:integration.readConfig,resolve:integration.resolveRuntime,set:integration.setPetStopped};
 const root=process.env.INORI_INTEGRATION_TEST_DIR;if(!root)throw Error('Use isolated data');
 const dir=path.join(root,'manual-exit-settings');fs.mkdirSync(path.join(dir,'resources/run-data'),{recursive:true});
 fs.writeFileSync(path.join(dir,'resources/run-data/settings.json'),JSON.stringify({skin:'battle',size:.8,accountFingerprint:'must-not-leak'}));
 integration.readConfig=()=>({petStopped:true,followCodex:true});integration.resolveRuntime=()=>({exe:path.join(dir,'pet.exe')});
 try{
  for(let i=0;i<3;i++){const value=await control.settings();assert.equal(value.runtimeStopped,true);assert.equal(value.settings.visible,false);assert.equal(value.settings.skin,'battle');assert.equal(value.settings.size,.8);assert.equal('accountFingerprint'in value.settings,false);}
  await assert.rejects(control.settings({size:1}),/打开宠物/);
 }finally{integration.readConfig=previous.read;integration.resolveRuntime=previous.resolve;integration.setPetStopped=previous.set;}
});
test('explicit visible request clears the exit flag and reaches the authenticated settings bridge',async()=>{
 const fs=require('node:fs'),path=require('node:path');
 const integration=require('../plugins/codex-pet/server/integration.cjs'),control=require('../plugins/codex-pet/server/control-client.cjs');
 const previous={read:integration.readConfig,resolve:integration.resolveRuntime,set:integration.setPetStopped,data:process.env.INORI_DATA_DIR};
 const root=path.join(process.env.INORI_INTEGRATION_TEST_DIR,'manual-resume');fs.mkdirSync(root,{recursive:true});process.env.INORI_DATA_DIR=root;
 let stopped=true,visible=false;
 const server=await require('../src/inori/settings/control-server.cjs').startControlServer({get:()=>({settings:{visible}}),apply:p=>{visible=p.visible;return {settings:{visible}};}},root);
 integration.readConfig=()=>({petStopped:stopped,followCodex:true});integration.resolveRuntime=()=>({exe:path.join(root,'pet.exe')});integration.setPetStopped=value=>{stopped=value;};
 try{const result=await control.settings({visible:true});assert.equal(stopped,false);assert.equal(result.settings.visible,true);}
 finally{server.close();integration.readConfig=previous.read;integration.resolveRuntime=previous.resolve;integration.setPetStopped=previous.set;if(previous.data===undefined)delete process.env.INORI_DATA_DIR;else process.env.INORI_DATA_DIR=previous.data;}
});
