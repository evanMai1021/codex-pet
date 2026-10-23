'use strict';
function createDesktopExitGate(){
 let seen=false,missing=0;
 return running=>{
  if(running===true){seen=true;missing=0;return false;}
  if(running!==false){missing=0;return false;}
  if(!seen)return false;
  return ++missing>=2;
 };
}
module.exports={createDesktopExitGate};
