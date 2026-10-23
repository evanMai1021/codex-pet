// Actual settings window and IPC, isolated profile and injected OS registration.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
const {createSettingsPanel}=require('../src/inori/settings/controller.cjs');
const out=process.env.INORI_TEST_OUT;if(!out)throw Error('Set isolated INORI_TEST_OUT');
app.setPath('userData',process.env.INORI_DATA_DIR);fs.mkdirSync(out,{recursive:true});
const raw={followCodex:false,skin:'battle',size:1,dock:'right',dockEnabled:true,reduced:false,visible:true,status:{state:'idle',label:'模拟状态'}};
const patches=[];const panel=createSettingsPanel({hidden:true,get:()=>raw,apply:p=>{patches.push(p);Object.assign(raw,p);}});
app.whenReady().then(async()=>{
 const window=await panel.open();const js=s=>window.webContents.executeJavaScript(s);
 const checks=[];const record=(name,pass)=>checks.push({name,pass});
 await new Promise(r=>setTimeout(r,250));
 record('startup-toggle-present-and-default-off',await js("document.getElementById('followCodex').checked===false"));
 await js("document.getElementById('followCodex').click()");await new Promise(r=>setTimeout(r,100));
 record('click-sends-boolean-patch',patches.at(-1)?.followCodex===true&&raw.followCodex===true);
 record('outfit-and-position-preserved',raw.skin==='battle'&&raw.dock==='right'&&raw.size===1);
 record('saved-feedback',await js("document.getElementById('message').textContent==='已保存'"));
 const invalid=await js("window.pet.set({followCodex:'true'}).then(()=>false,()=>true)");record('invalid-boolean-rejected',invalid);
 await js("document.getElementById('followCodex').click()");await new Promise(r=>setTimeout(r,100));
 record('can-disable-and-display-off',raw.followCodex===false&&await js("!document.getElementById('followCodex').checked"));
 const result={passed:checks.every(c=>c.pass),mode:'native-window-and-IPC; OS-registration-injected',checks};
 fs.writeFileSync(path.join(out,'integration-report.json'),JSON.stringify(result,null,2));app.exit(result.passed?0:1);
}).catch(e=>{fs.writeFileSync(path.join(out,'integration-error.txt'),String(e.stack));app.exit(2);});
setTimeout(()=>app.exit(3),15000);
