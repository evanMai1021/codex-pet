'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('reduced motion pauses the same video and resumes it without changing the source',async()=>{
 let created=0;
 const context={document:{createElement:()=>{created++;return {readyState:2,currentTime:1.25,paused:true,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){},load(){},remove(){}};}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/inori/renderer/video-animation.js'),'utf8'),context);
 const player=new context.InoriVideoAnimation(),manifest={videos:{idle:{file:'idle.webm'}}};
 const normal=player.frame('skin',manifest,'idle','/',true,'same');await Promise.resolve();
 const reduced=player.frame('skin',manifest,'idle','/',true,'same',true);
 assert.equal(reduced.video,normal.video);assert.equal(reduced.video.paused,true);assert.equal(reduced.video.currentTime,1.25);
 player.frame('skin',manifest,'idle','/',true,'same',false);await Promise.resolve();assert.equal(normal.video.paused,false);assert.equal(created,1);
});
