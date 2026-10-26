'use strict';
// Explicit local deployment check: opens the user-configured pet through its installed plugin.
const fs=require('node:fs'),path=require('node:path');
const plugin=process.argv[2],out=process.argv[3];if(!plugin||!out)throw Error('Provide installed plugin path and D-drive report path');
const api=require(path.join(path.resolve(plugin),'server/index.cjs'));
(async()=>{
 const initialize=await api.handle({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}});
 const controls=await api.handle({jsonrpc:'2.0',id:2,method:'tools/list'});
 const opened=await api.handle({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'pet_open',arguments:{}}});
 const report={version:initialize.result?.serverInfo?.version,toolCount:controls.result?.tools?.length,petOpened:!opened.result?.isError&&JSON.parse(opened.result?.content?.[0]?.text||'{}').opened===true};
 report.passed=report.version==='0.1.14'&&report.toolCount===8&&report.petOpened;
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
