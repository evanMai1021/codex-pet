'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const integration=require('./integration.cjs');
function endpointFile(){
 const {exe}=integration.resolveRuntime(integration.readConfig());
 return path.join(process.env.INORI_DATA_DIR||path.join(path.dirname(exe),'resources','run-data'),'settings-control.json');
}
function requestSettings(patch){return new Promise((resolve,reject)=>{
 let endpoint;try{endpoint=JSON.parse(fs.readFileSync(endpointFile(),'utf8'));}catch{return reject(Error('桌宠尚未连接'));}
 if(!Number.isInteger(endpoint.port)||endpoint.port<1||endpoint.port>65535||!/^\w{64}$/.test(endpoint.token||''))return reject(Error('设置连接信息无效'));
 const body=patch===undefined?null:JSON.stringify(patch);
 const req=http.request({host:'127.0.0.1',port:endpoint.port,path:'/settings',method:body?'POST':'GET',headers:{Authorization:'Bearer '+endpoint.token,...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},res=>{
  let data='';res.setEncoding('utf8');res.on('data',c=>{data+=c;if(data.length>131072)res.destroy(Error('响应过大'));});
  res.on('error',reject);res.on('end',()=>{try{const v=JSON.parse(data);res.statusCode===200?resolve(v):reject(Error(v.error||'设置失败'));}catch{reject(Error('设置响应无效'));}});
 });
 req.setTimeout(1800,()=>req.destroy(Error('桌宠连接超时')));req.on('error',()=>reject(Error('桌宠尚未连接')));if(body)req.write(body);req.end();
});}
let connecting;
async function connect(){
 try{return await requestSettings();}catch{}
 if(!connecting)connecting=(async()=>{
  await integration.launchPet(['--control-only']);
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,150));try{return await requestSettings();}catch{}}
  throw Error('无法连接桌宠设置，请确认已更新桌宠程序');
 })().finally(()=>{connecting=null;});
 return connecting;
}
async function settings(patch){const value=await connect();return patch===undefined?value:requestSettings(patch);}
module.exports={settings,requestSettings,endpointFile};
