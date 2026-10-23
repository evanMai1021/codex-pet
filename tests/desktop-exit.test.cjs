const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDesktopExitGate}=require('../src/inori/desktop-exit.cjs');
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
