// Local stdio MCP: one entry point opens the graphical settings window.
'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
async function launch(){
 const configFile=path.join(process.env.CODEX_PET_HOME||path.join(process.env.APPDATA||require('node:os').homedir(),'CodexPet'),'runtime.json');
 let config;try{config=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{throw Error('请先配置原楪祈桌宠启动位置。');}
 if(typeof config.inoriExecutable!=='string'||!fs.existsSync(config.inoriExecutable))throw Error('原楪祈桌宠未配置或文件不存在；不会启动替代角色。');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(config.inoriExecutable,['--settings'],{cwd:path.dirname(config.inoriExecutable),detached:true,windowsHide:true,stdio:'ignore',env});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('原楪祈桌宠启动失败')));});child.unref();
 return {opened:true,character:'inori',note:'已请求打开原楪祈桌宠设置，不创建其他角色。'};
}

const tool={name:'pet_open_settings',description:'打开本机 Codex Pet 图形设置窗口。显示、大小、贴边与减少动画均控制原楪祈实例。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
async function handle(m){
 if(!m||m.jsonrpc!=='2.0'||typeof m.method!=='string')return {jsonrpc:'2.0',id:m?.id??null,error:{code:-32600,message:'Invalid request'}};
 if(m.id===undefined)return null;
 const result=value=>({jsonrpc:'2.0',id:m.id,result:value});
 if(m.method==='initialize')return result({protocolVersion:['2025-11-25','2025-06-18','2024-11-05'].includes(m.params?.protocolVersion)?m.params.protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'codex-pet',version:'0.1.10'}});
 if(m.method==='ping')return result({});
 if(m.method==='tools/list')return result({tools:[tool]});
 if(m.method==='tools/call'){
  if(m.params?.name!==tool.name)return {jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Unknown tool'}};
  const args=m.params.arguments??{};
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)return result({isError:true,content:[{type:'text',text:'此工具不接受参数。'}]});
  try{return result({content:[{type:'text',text:JSON.stringify(await launch())}]});}
  catch(e){return result({isError:true,content:[{type:'text',text:e.message}]});}
 }
 return {jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Method not found'}};
}
if(require.main===module){
 const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
 rl.on('line',async line=>{let response;if(Buffer.byteLength(line)>65536){process.stderr.write('Request too large\n');return;}
  try{response=await handle(JSON.parse(line));}catch{response={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}};}
  if(response)process.stdout.write(JSON.stringify(response)+'\n');
 });
}
module.exports={handle};
