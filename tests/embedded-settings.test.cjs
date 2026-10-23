'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {validatePatch,properties}=require('../src/inori/settings/schema.cjs');
test('every native setting is supported with strict whole-patch validation',()=>{
 assert.equal(Object.keys(properties).length,10);
 for(const p of [null,[],{}, {size:.9},{dock:'unknown'},{skin:'cat'},{visible:1},{bubbleCustomLine:'x'.repeat(57)},{arbitrary:'x'},{followCodex:'true'}])assert.throws(()=>validatePatch(p));
 assert.throws(()=>validatePatch({dock:'left'},{dockEnabled:false}));
 assert.deepEqual(validatePatch({dockEnabled:true,dock:'top'},{dockEnabled:false}),{dockEnabled:true,dock:'top'});
 assert.deepEqual(validatePatch({bubbleTone:'affectionate',bubbleCustomLine:' hi '}),{bubbleTone:'cute',bubbleCustomLine:'hi'});
 assert.equal(fs.readFileSync(require.resolve('../src/inori/settings/schema.cjs'),'utf8'),fs.readFileSync(require.resolve('../plugins/codex-pet/server/schema.cjs'),'utf8'));
});
test('local settings bridge authenticates and rejects browser origins and invalid patches',async()=>{
 const base=process.env.INORI_INTEGRATION_TEST_DIR;if(!base)throw Error('Use isolated test directory');
 const data=path.join(base,'control-bridge');let raw={size:1,skin:'redwhite',dockEnabled:true};
 const server=await require('../src/inori/settings/control-server.cjs').startControlServer({get:()=>({settings:raw}),apply:p=>{Object.assign(raw,validatePatch(p,raw));return {settings:raw};}},data);
 try{
  const ep=JSON.parse(fs.readFileSync(path.join(data,'settings-control.json'),'utf8'));
  const request=(method,body,headers={})=>new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:ep.port,path:'/settings',method,headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({code:res.statusCode,value:JSON.parse(text)}));});r.on('error',reject);r.end(body);});
  assert.equal((await request('GET')).code,403);
  assert.equal((await request('GET',null,{Authorization:'Bearer '+ep.token,Origin:'https://example.com'})).code,403);
  const headers={Authorization:'Bearer '+ep.token,'Content-Type':'application/json'};
  assert.equal((await request('POST',JSON.stringify({size:.8,skin:'battle'}),headers)).code,200);
  assert.equal(raw.size,.8);assert.equal(raw.skin,'battle');
  assert.equal((await request('POST',JSON.stringify({size:1,visible:'wrong'}),headers)).code,400);
  assert.equal(raw.size,.8);
  assert.equal((await request('GET',null,headers)).value.settings.skin,'battle');
 }finally{server.close();}
 assert.equal(fs.existsSync(path.join(data,'settings-control.json')),false);
});
