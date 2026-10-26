'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{Readable}=require('node:stream');
const updates=require('../plugins/codex-pet/server/release-manager.cjs');
const release=()=>({tag_name:'v0.1.99',draft:false,prerelease:false,assets:['inori-codex-pet-v0.1.99.zip','codex-pet-plugin-v0.1.99.zip'].map(name=>({name,size:10,digest:'sha256:'+'a'.repeat(64),browser_download_url:'https://github.com/evanMai1021/codex-pet/releases/download/v0.1.99/'+name}))});
test('update plans require both matching official assets and SHA256 metadata',()=>{
 assert.equal(updates.releasePlan(release()).assets.length,2);
 for(const mutate of [r=>r.assets.pop(),r=>r.assets[0].digest='',r=>r.assets[0].browser_download_url='https://example.com/x.zip',r=>r.prerelease=true,r=>r.tag_name='v1.2.3/../../']){const r=release();mutate(r);assert.throws(()=>updates.releasePlan(r));}
 assert.equal(updates.newer('0.1.14','0.1.13'),true);assert.equal(updates.newer('0.1.9','0.1.14'),false);assert.equal(updates.newer('0.1.14','0.1.14'),false);
});
test('downloads reject truncated or tampered bytes before any switch',async()=>{
 const dir=path.join(process.env.INORI_INTEGRATION_TEST_DIR,'downloads-'+Date.now());fs.mkdirSync(dir,{recursive:true});const body=Buffer.from('verified'),asset={url:'unused',size:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex')};
 await updates.download(asset,path.join(dir,'valid'),()=>{},async()=>Readable.from([body]));
 await assert.rejects(updates.download(asset,path.join(dir,'bad'),()=>{},async()=>Readable.from([Buffer.from('tampered')])));
 await assert.rejects(updates.download(asset,path.join(dir,'short'),()=>{},async()=>Readable.from([Buffer.from('x')])));
});
test('worker migrates settings, switches both components, and restores runtime config on plugin failure',async()=>{
 const homeBefore=process.env.CODEX_PET_HOME;const root=path.join(process.env.INORI_INTEGRATION_TEST_DIR,'worker-'+Date.now());fs.mkdirSync(root,{recursive:true});process.env.CODEX_PET_HOME=path.join(root,'home');fs.mkdirSync(process.env.CODEX_PET_HOME);
 const config=path.join(process.env.CODEX_PET_HOME,'runtime.json'),old=path.join(root,'old','楪祈桌宠.exe'),settings=path.join(path.dirname(old),'resources/run-data/settings.json');fs.mkdirSync(path.dirname(settings),{recursive:true});fs.writeFileSync(settings,JSON.stringify({size:.8,skin:'battle'}));fs.writeFileSync(old,'old');const original={inoriExecutable:old,followCodex:true,other:'preserved'};
 try{for(const fail of [false,true]){
  fs.writeFileSync(config,JSON.stringify(original));let launched=0,pluginCalls=0;const dir=path.join(root,fail?'failure':'success');fs.mkdirSync(dir);
  await updates.worker(dir,{latest:async()=>release(),download:async(a,file)=>fs.writeFileSync(file,'fixture'),launch:async()=>{launched++;},powershell:args=>{
   if(args[1]==='plugin'){pluginCalls++;if(fail)throw Error('fixture plugin install failed');return;}
   const dest=args[args.indexOf('-Destination')+1];const f=path.join(dest,dest.endsWith('plugin')?'plugins/codex-pet/plugin.json':'inori-codex-pet-v0.1.99/resources/app/package.json');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify({version:'0.1.99'}));if(!dest.endsWith('plugin'))fs.writeFileSync(path.join(dest,'inori-codex-pet-v0.1.99/楪祈桌宠.exe'),'new');
  }});
  assert.equal(pluginCalls,1);const state=JSON.parse(fs.readFileSync(path.join(dir,'pet-update-state.json'),'utf8')),next=JSON.parse(fs.readFileSync(config,'utf8'));
  if(fail){assert.equal(state.stage,'error');assert.deepEqual(next,original);assert.equal(launched,0);}else{assert.equal(state.stage,'complete');assert.equal(next.other,'preserved');assert.equal(next.followCodex,true);assert.equal(launched,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(path.dirname(next.inoriExecutable),'resources/run-data/settings.json'),'utf8')),{size:.8,skin:'battle'});}
  assert.equal(fs.readFileSync(old,'utf8'),'old');
 }}finally{if(homeBefore===undefined)delete process.env.CODEX_PET_HOME;else process.env.CODEX_PET_HOME=homeBefore;}
});
