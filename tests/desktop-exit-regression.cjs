// Real app shutdown path with explicit simulated desktop-presence samples.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=process.env.INORI_TEST_OUT;if(!out)throw Error('Use isolated test directories');fs.mkdirSync(out,{recursive:true});
const main=path.resolve(__dirname,'../src/inori/main.cjs');process.argv.push('--no-bridge','--settings-self-test');
const actual=require('electron');class HiddenWindow extends BrowserWindow{constructor(options){super({...options,show:false});}}
const underTest=new Module(main,module);underTest.filename=main;underTest.paths=Module._nodeModulePaths(path.dirname(main));
const nativeRequire=underTest.require.bind(underTest);underTest.require=name=>name==='electron'?{...actual,BrowserWindow:HiddenWindow}:nativeRequire(name);
underTest._compile(fs.readFileSync(main,'utf8')+'\nmodule.exports={takeMessage,getWindow:()=>win};',main);
let expectedExit=false,passed=false;
app.on('before-quit',()=>{if(expectedExit){passed=true;fs.writeFileSync(path.join(out,'desktop-exit-report.json'),JSON.stringify({passed:true,mode:'real-app-quit; simulated-desktop-presence',normalQuitTriggered:true},null,2));}});
app.whenReady().then(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<80&&!underTest.exports.getWindow();i++)await wait(100);await wait(500);
 const api=underTest.exports;api.takeMessage({kind:'desktopLifecycle',running:true});
 api.takeMessage({kind:'desktopLifecycle',running:null});api.takeMessage({kind:'desktopLifecycle',running:false});
 await wait(100);if(passed)throw Error('Premature shutdown');
 api.takeMessage({kind:'desktopLifecycle',running:true});api.takeMessage({kind:'desktopLifecycle',running:false});
 expectedExit=true;api.takeMessage({kind:'desktopLifecycle',running:false});
}).catch(e=>{fs.writeFileSync(path.join(out,'desktop-exit-error.txt'),String(e.stack));app.exit(2);});
setTimeout(()=>{if(!passed)app.exit(3);},15000);
