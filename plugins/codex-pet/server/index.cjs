// Local stdio MCP and embedded settings panel.
'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const integration=require('./integration.cjs');
const control=require('./control-client.cjs'),{properties,validatePatch}=require('./schema.cjs');
const UI='ui://codex-pet/control-panel';
const settingsCapability={readTool:'pet_settings_read',updateTool:'pet_settings_update'};
const startup=integration.createPluginStartup();

const empty={type:'object',properties:{},additionalProperties:false};
const settingsSchema={type:'object',properties:{schema:{type:'object'},values:{type:'object'},layout:{type:'array',items:{type:'object'}}},required:['schema','values']};
const panelMeta={ui:{resourceUri:UI},'openai/outputTemplate':UI,'openai/ui':{entrypoints:[{type:'global'},{type:'thread'}]}};
const tools=[
 {name:'pet_open_settings',title:'桌宠设置面板',description:'在 Codex 内显示完整桌宠设置，不打开独立设置窗口。',inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},_meta:{ui:{resourceUri:UI},'openai/outputTemplate':UI}},
 {name:'pet_open',title:'打开宠物',description:'显示桌面楪祈公仔，不打开设置窗口。',inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'pet_control_panel',title:'楪祈桌宠设置',description:'在 Codex 中调整服装、大小、趴边、任务气泡及随 Codex 启动。',inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},_meta:panelMeta},
 {name:'pet_settings_read',title:'读取桌宠设置',description:'读取完整设置；未运行时连接后台桌宠，不弹出设置窗口。',inputSchema:empty,outputSchema:settingsSchema,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
 {name:'pet_settings_update',title:'修改桌宠设置',description:'立即应用并保存指定设置，不打开独立窗口。',inputSchema:{type:'object',properties:{set:{type:'object',properties,minProperties:1,additionalProperties:false}},required:['set'],additionalProperties:false},outputSchema:settingsSchema,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
async function readSettings(patch){
 const data=await control.settings(patch);
 return {schema:{type:'object',properties,additionalProperties:false},values:data.settings,status:data.status,phrases:data.phrases,skins:data.skins,layout:[
  {kind:'group',title:'桌面公仔',items:[{kind:'tool',tool:'pet_open'},...['visible','followCodex','skin','size','reduced','dockEnabled','dock'].map(property=>({kind:'property',property}))]},
  {kind:'group',title:'任务气泡',items:['bubbleEnabled','bubbleTone','bubbleCustomLine'].map(property=>({kind:'property',property}))}
 ]};
}
function structured(value){return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
async function handle(m){
 if(!m||m.jsonrpc!=='2.0'||typeof m.method!=='string')return {jsonrpc:'2.0',id:m?.id??null,error:{code:-32600,message:'Invalid request'}};
 if(m.id===undefined){if(m.method==='notifications/initialized')try{await startup();}catch{process.stderr.write('Codex Pet: automatic launch failed; open the pet manually to inspect configuration.\n');}return null;}
 const result=value=>({jsonrpc:'2.0',id:m.id,result:value});
 if(m.method==='initialize')return result({protocolVersion:['2025-11-25','2025-06-18','2024-11-05'].includes(m.params?.protocolVersion)?m.params.protocolVersion:'2025-11-25',capabilities:{tools:{},resources:{},extensions:{'openai/settings':settingsCapability},experimental:{'openai/settings':settingsCapability}},serverInfo:{name:'codex-pet',version:'0.1.12'}});
 if(m.method==='ping')return result({});
 if(m.method==='tools/list')return result({tools});
 if(m.method==='resources/list')return result({resources:[{uri:UI,name:'楪祈桌宠控制面板',mimeType:'text/html;profile=mcp-app'}]});
 if(m.method==='resources/read'){
  if(m.params?.uri!==UI)return {jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Unknown resource'}};
  return result({contents:[{uri:UI,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(root,'ui','control.html'),'utf8'),_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}},'openai/ui':{availableDisplayModes:['inline','fullscreen']}}}]});
 }
 if(m.method==='tools/call'){
  const name=m.params?.name;
  if(!tools.some(t=>t.name===name))return {jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'Unknown tool'}};
  const args=m.params.arguments??{};
  if(!args||typeof args!=='object'||Array.isArray(args)||(name!=='pet_settings_update'&&Object.keys(args).length))return result({isError:true,content:[{type:'text',text:'工具参数无效。'}]});
  try{
   if(['pet_settings_read','pet_control_panel','pet_open_settings'].includes(name))return result(structured(await readSettings()));
   if(name==='pet_open')return result({content:[{type:'text',text:JSON.stringify(await integration.launchPet())}]});
   if(name==='pet_settings_update'){
    if(Object.keys(args).length!==1)throw Error('工具参数无效');
    const patch=validatePatch(args.set);
    return result(structured(await readSettings(patch)));
   }
   throw Error('工具不可用');}
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
module.exports={handle,readSettings,tools};
