'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const integration=require('./integration.cjs');
function endpointFile(){
 const {exe}=integration.resolveRuntime(integration.readConfig());
 return path.join(process.env.INORI_DATA_DIR||path.join(path.dirname(exe),'resources','run-data'),'settings-control.json');
}
function requestSettings(patch,route='/settings'){return new Promise((resolve,reject)=>{
 let endpoint;try{endpoint=JSON.parse(fs.readFileSync(endpointFile(),'utf8'));}catch{return reject(Error('桌宠尚未连接'));}
 if(!Number.isInteger(endpoint.port)||endpoint.port<1||endpoint.port>65535||!/^\w{64}$/.test(endpoint.token||''))return reject(Error('设置连接信息无效'));
 const body=patch===undefined?null:JSON.stringify(patch);
 const req=http.request({host:'127.0.0.1',port:endpoint.port,path:route,method:body?'POST':'GET',headers:{Authorization:'Bearer '+endpoint.token,...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},res=>{
  let data='';res.setEncoding('utf8');res.on('data',c=>{data+=c;if(data.length>131072)res.destroy(Error('响应过大'));});
  res.on('error',reject);res.on('end',()=>{try{const v=JSON.parse(data);res.statusCode===200?resolve(v):reject(Error(v.error||'设置失败'));}catch{reject(Error('设置响应无效'));}});
 });
 req.setTimeout(1800,()=>req.destroy(Error('桌宠连接超时')));req.on('error',()=>reject(Error('桌宠尚未连接')));if(body)req.write(body);req.end();
});}
let connecting;
async function connect(){
 try{return await requestSettings();}catch{}
 if(require('./release-manager.cjs').status().state?.stage==='switching')throw Error('正在切换桌宠版本，请稍后重试');
 if(!connecting)connecting=(async()=>{
  await integration.launchPet(['--control-only']);
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,150));try{return await requestSettings();}catch{}
 if(require('./release-manager.cjs').status().state?.stage==='switching')throw Error('正在切换桌宠版本，请稍后重试');}
  throw Error('无法连接桌宠设置，请确认已更新桌宠程序');
 })().finally(()=>{connecting=null;});
 return connecting;
}
function stoppedSettings(){
 const config=integration.readConfig(),{exe}=integration.resolveRuntime(config);let saved={};
 try{saved=JSON.parse(fs.readFileSync(path.join(process.env.INORI_DATA_DIR||path.join(path.dirname(exe),'resources/run-data'),'settings.json'),'utf8'));}catch{}
 const defaults={bubblePinnedPage:'off',bubblePosition:'auto',bubbleOffsetX:0,bubbleOffsetY:0,visible:false,skin:'redwhite',size:1,reduced:false,dockEnabled:true,dock:null,bubbleEnabled:true,quotaStyle:'style2',quotaBadgeVisible:true,bubbleScale:1,bubbleTone:'cute',bubbleCustomLine:''};
 const settings={...defaults};for(const key of Object.keys(require('./schema.cjs').properties))if(key in saved)settings[key]=saved[key];
 settings.visible=false;settings.followCodex=config.followCodex===true;
 return {settings,status:{state:'stopped',label:'宠物已退出'},phrases:[],skins:[],runtimeStopped:true};
}
async function settings(patch){
 if(integration.readConfig().petStopped===true){
  if(patch?.visible===true)integration.setPetStopped(false);
  else if(patch)throw Error('宠物已退出，请先点击“打开宠物”');
  else return stoppedSettings();
 }
 const value=await connect();return patch===undefined?value:requestSettings(patch);
}
async function quit(){
 integration.setPetStopped(true);
 let endpoint;try{endpoint=JSON.parse(fs.readFileSync(endpointFile(),'utf8'));}catch{return {stopped:true};}
 try{await requestSettings({action:'quit'},'/lifecycle');}catch(error){
  try{process.kill(endpoint.pid,0);throw error;}catch(check){if(check.code!=='ESRCH')throw check;}
 }
 for(let i=0;i<60;i++){
  try{process.kill(endpoint.pid,0);}catch(error){if(error.code==='ESRCH')return {stopped:true};throw error;}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw Error('宠物正在退出，请稍后查看；不会自动重新启动');
}
module.exports={settings,requestSettings,endpointFile,quit,lifecycle:message=>requestSettings(message,'/lifecycle')};
