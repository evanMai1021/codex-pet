'use strict';
(function(root){
 // Use the union of visible source boxes, never one transient animation frame.
 function visibleEnvelope(manifest,pose,animation){
  const boxes=[];
  if(pose){
   const dock=manifest.dock,key=pose==='top'&&dock.topDerivedFromBottom?'bottom':pose,sequence=dock.animations?.[key];
   const count=sequence?.frames?.length||1;
   for(let i=0;i<count;i++){
    const f=animation.dockLayout(dock,pose,i*(sequence?.frameMs||1),false),[l,t,r,b]=f.box;
    let x=f.x+l*f.scale,y=f.y+t*f.scale,width=(r-l)*f.scale,height=(b-t)*f.scale;
    if(f.rotate){x=192-x-width;y=208-y-height;}
    boxes.push({x,y,width,height});
   }
  }else{
   for(const clip of Object.values(manifest.clips))for(const frame of clip.frames){
    const [, ,w,h]=frame.source,[l,t,r,b]=frame.box,[x,y,width,height]=frame.draw;
    boxes.push({x:x+l*width/w,y:y+t*height/h,width:(r-l)*width/w,height:(b-t)*height/h});
   }
   // Videos and transient effects have no static alpha bounds in the manifest.
   if(Object.keys(manifest.videos||{}).length)boxes.push({x:0,y:0,width:192,height:208});
  }
  if(!boxes.length)return{x:0,y:0,width:192,height:208};
  const x=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.x))-2)),y=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.y))-2));
  const right=Math.min(192,Math.ceil(Math.max(...boxes.map(b=>b.x+b.width))+2)),bottom=Math.min(208,Math.ceil(Math.max(...boxes.map(b=>b.y+b.height))+2));
  return{x,y,width:right-x,height:bottom-y};
 }
 root.InoriBubbleGeometry={visibleEnvelope};
 if(typeof module!=='undefined')module.exports={visibleEnvelope};
})(globalThis);
