'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// The browser never receives this endpoint or its per-process secret.
async function startControlServer(panel,dataDir,lifecycle){
 const file=path.join(dataDir,'settings-control.json'),token=crypto.randomBytes(32).toString('hex');
 const server=http.createServer((req,res)=>{
  const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(req.headers.origin||supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return reply(403,{error:'拒绝访问'});
  if(req.url!=='/settings'&&!(req.url==='/lifecycle'&&lifecycle))return reply(404,{error:'接口不存在'});
  if(req.method==='GET'&&req.url==='/settings')return reply(200,panel.get());
  if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return reply(405,{error:'请求无效'});
  let body='',bytes=0;req.setEncoding('utf8');
  req.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>4096)req.destroy();else body+=chunk;});
  req.on('end',()=>{try{const value=JSON.parse(body);reply(200,req.url==='/lifecycle'?lifecycle(value):panel.apply(value));}catch(e){reply(400,{error:e.message});}});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 fs.mkdirSync(dataDir,{recursive:true});
 fs.writeFileSync(file,JSON.stringify({port:server.address().port,token,pid:process.pid}),{mode:0o600});
 server.unref();
 return {close(){server.close();try{if(JSON.parse(fs.readFileSync(file,'utf8')).token===token)fs.unlinkSync(file);}catch{}}};
}
module.exports={startControlServer};
