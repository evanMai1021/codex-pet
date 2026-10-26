'use strict';
// Freeze local geometry across animation frames; translate only with the window.
function createBubbleAnchor(){
 let key='',local;
 return (bounds,body,identity='')=>{
  const next=JSON.stringify([bounds.width,bounds.height,identity,body?.bubbleBounds]);
  if(!body&&!local)return null;
  if(next!==key&&body){key=next;const scale=bounds.width/300;
   const envelope=body.bubbleBounds;
   const region=envelope&&['x','y','width','height'].every(k=>Number.isFinite(envelope[k]))&&envelope.width>0&&envelope.height>0?envelope:body;
   local={x:Math.floor(region.x*scale),y:Math.floor(region.y*scale),width:Math.max(1,Math.ceil((region.x+region.width)*scale)-Math.floor(region.x*scale)),height:Math.max(1,Math.ceil((region.y+region.height)*scale)-Math.floor(region.y*scale))};}
  if(!local)return null;
  return {...local,x:bounds.x+local.x,y:bounds.y+local.y};
 };
}
module.exports={createBubbleAnchor};
