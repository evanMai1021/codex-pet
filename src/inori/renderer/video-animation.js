'use strict';
// Optional transparent WebM per state: one lazy decoder instead of thousands of images.
class InoriVideoAnimation{
 constructor(){this.video=null;this.key='';this.failed=new Set();this.error=null;}
 stop(){if(this.video){this.video.pause();this.video.removeAttribute('src');this.video.load();this.video.remove?.();}this.video=null;this.key='';}
 frame(skinId,manifest,state,base,enabled,playbackId='',reduced=false){
  this.reduced=reduced;
  const entry=manifest.videos?.[state];
  if(!enabled||!entry){if(this.video)this.stop();return null;}
  if(typeof entry.file!=='string'||!/^[-\w./]+\.webm$/i.test(entry.file)||entry.file.split('/').includes('..')){this.error='连续动画文件路径无效';return null;}
  const sourceKey=skinId+':'+entry.file,key=sourceKey+':'+playbackId;
  if(this.failed.has(sourceKey))return null;
  const failed=()=>{if(this.key===key){this.error='连续动画不可用，已回退原图集';this.failed.add(sourceKey);this.stop();}};
  const play=()=>{const video=this.video;video.play().then(()=>{if(this.video===video&&this.reduced)video.pause();}).catch(error=>{if(error?.name!=='AbortError')failed();});};
  if(key!==this.key){
   this.stop();this.key=key;this.error=null;
   const video=document.createElement('video');this.video=video;video.muted=true;video.playsInline=true;video.loop=entry.loop!==false;video.preload='auto';
   video.onerror=failed;video.src=base+entry.file;if(reduced)video.load();else play();
  }
  if(reduced){if(!this.video.paused)this.video.pause();}else if(this.video.paused)play();
  return this.video?.readyState>=2?{video:this.video,key:key+':'+Math.floor(this.video.currentTime*1000/(entry.frameMs||1000/24))}:null;
 }
}
globalThis.InoriVideoAnimation=InoriVideoAnimation;
