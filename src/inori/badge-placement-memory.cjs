'use strict';
// Remember user placement separately from the badge's temporary edge avoidance.
function createBadgePlacementMemory(){
 let identity=null,positions=new Map();
 function reset(){identity=null;positions.clear();}
 function begin(targetVisible,bounds,context){
  if(identity!==context){reset();identity=context;}
  positions.set(!targetVisible,{x:bounds.x,y:bounds.y});
  const restore=positions.get(targetVisible);
  return restore?{...restore}:null;
 }
 return {begin,reset};
}
module.exports={createBadgePlacementMemory};
