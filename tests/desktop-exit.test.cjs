const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDesktopExitGate,createDesktopPidWatch}=require('../src/inori/desktop-exit.cjs');

test('bound main PID exits even after bridge stops or renderer survives',()=>{
 let alive=true;const watch=createDesktopPidWatch(pid=>pid===100?alive:true);
 watch.bind([100]);assert.equal(watch.shouldQuit(),false);
 alive=false;watch.bind([101]);assert.equal(watch.shouldQuit(),false);assert.equal(watch.shouldQuit(),true);
});
test('PID watch ignores unknown, malformed and unbound evidence',()=>{
 let state=null;const watch=createDesktopPidWatch(()=>state);
 watch.bind([0]);assert.equal(watch.shouldQuit(),false);watch.bind([100]);
 assert.equal(watch.shouldQuit(),false);state=false;assert.equal(watch.shouldQuit(),false);
 state=null;assert.equal(watch.shouldQuit(),false);state=false;assert.equal(watch.shouldQuit(),false);assert.equal(watch.shouldQuit(),true);
});
test('standalone launch without seeing Codex remains usable',()=>{
 const gate=createDesktopExitGate();assert.equal(gate(false),false);assert.equal(gate(false),false);
});
test('background desktop process keeps pet alive; two confirmed absences quit',()=>{
 const gate=createDesktopExitGate();assert.equal(gate(true),false);assert.equal(gate(true),false);
 assert.equal(gate(false),false);assert.equal(gate(false),true);
});
test('unknown state and process recovery reset missing count',()=>{
 const gate=createDesktopExitGate();gate(true);gate(false);assert.equal(gate(null),false);
 assert.equal(gate(false),false);assert.equal(gate(true),false);assert.equal(gate(false),false);
 assert.equal(gate(false),true);
});
test('malformed lifecycle values cannot trigger shutdown',()=>{
 const gate=createDesktopExitGate();gate(true);for(const value of [undefined,'false',0,{},null])assert.equal(gate(value),false);
 assert.equal(gate(false),false);
});
