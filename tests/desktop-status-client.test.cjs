'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const net=require('node:net');
const {DesktopStatusClient}=require('../src/inori/desktop-status/client.cjs');

test('transport errors export codes only and successful initialize clears them',()=>{
 const connect=net.createConnection;
 const socket=new EventEmitter();socket.end=()=>{};socket.destroy=()=>{};
 net.createConnection=()=>socket;
 const client=new DesktopStatusClient();
 try{
  client.connect();socket.emit('error',{code:'ENOENT',message:'fixture-private-path'});
  assert.equal(client.snapshot().errorCode,'ENOENT');
  assert.ok(!JSON.stringify(client.snapshot()).includes('fixture-private-path'));
  socket.emit('error',{code:'fixture-private-code'});
  assert.equal(client.snapshot().errorCode,'CONNECTION_ERROR');
  client.handle({type:'response',requestId:'fixture',resultType:'success',result:{clientId:'client'}},'fixture');
  assert.equal(client.snapshot().errorCode,null);assert.equal(client.snapshot().connected,true);
 }finally{client.stop();net.createConnection=connect;}
});
