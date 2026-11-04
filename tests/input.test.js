// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {XboxInput,stick} from '../src/controller.js';
import {TouchInput} from '../src/touch.js';
function pad(){return {index:0,id:'Xbox test',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};}
test('radial deadzones preserve analog motion, diagonal length and fine aim',()=>{
  assert.deepEqual(stick(.05,-.05),[0,0]);assert.deepEqual(stick(NaN,1),[0,0]);
  assert.deepEqual(stick(1,0,1),[0,0]);
  assert.ok(Math.abs(Math.hypot(...stick(1,1))-1)<1e-12);
  assert.ok(stick(.5,0)[0]>0&&stick(.5,0)[0]<.5);
  assert.ok(stick(.5,0,.16,1.6)[0]<stick(.5,0)[0]);
});
test('controller connection, pause and replacement require neutral sticks and triggers',()=>{
  const input=new XboxInput(),p=pad();p.buttons[7].value=.2;
  assert.equal(input.sample([p]).ready,false);p.buttons[7].value=1;assert.equal(input.sample([p]).fire,false);
  p.buttons[7].value=0;input.sample([p]);p.buttons[7].value=1;assert.equal(input.sample([p]).fire,true);
  input.reset();assert.equal(input.sample([p]).fire,false);
  p.buttons[7].value=0;input.sample([p]);p.id='replacement';p.axes[0]=.5;
  assert.equal(input.sample([p]).replaced,true);assert.equal(input.sample([p]).moveX,0);
  p.axes[0]=0;input.sample([p]);p.axes[0]=.5;assert.ok(input.sample([p]).moveX>0);
});
test('held triggers repeat fire while one-shot actions only edge once',()=>{
  const input=new XboxInput(),p=pad();input.sample([p]);p.buttons[7].value=1;p.buttons[0].value=1;p.buttons[9].value=1;
  let s=input.sample([p]);assert.equal(s.fire,true);assert.equal(s.jump,true);assert.equal(s.pause,true);
  s=input.sample([p]);assert.equal(s.fire,true);assert.equal(s.jump,false);assert.equal(s.pause,false);
  p.buttons[7].value=.15;assert.equal(input.sample([p]).fire,true);
  p.buttons[7].value=.05;assert.equal(input.sample([p]).fire,false);
});
test('disconnection clears actions and unknown mapping is ignored',()=>{
  const input=new XboxInput(),p=pad();input.sample([p]);p.axes[1]=-1;assert.equal(input.sample([p]).moveZ,1);
  assert.equal(input.sample([]).connected,false);assert.equal(input.sample([]).moveZ,0);
  p.mapping='';assert.equal(input.sample([p]).connected,false);
});
test('simultaneous touch move, aim and fire retain separate pointer owners',()=>{
  const t=new TouchInput();assert.equal(t.begin(1,'move',20,80),true);assert.equal(t.begin(2,'move'),false);
  t.begin(2,'look',200,100);t.begin(3,'fire',300,100);t.move(1,44,56);t.move(2,210,106);t.move(3,305,100);
  assert.ok(t.moveZ>0&&t.moveX>0);assert.equal(t.held('fire'),true);assert.deepEqual(t.consumeLook(),[15,6]);
  assert.deepEqual(t.consumeLook(),[0,0]);t.end(2);assert.equal(t.held('fire'),true);assert.ok(t.moveZ>0);
  t.end(3);assert.equal(t.held('fire'),false);t.end(1);assert.equal(t.moveZ,0);
});
test('pointer cancellation and lifecycle reset discard queued look and held actions',()=>{
  const t=new TouchInput();t.begin(1,'look',0,0);t.move(1,10,10);t.end(1,true);assert.deepEqual(t.consumeLook(),[0,0]);
  t.begin(2,'move');t.move(2,48,0);t.begin(3,'fire');t.clear();t.move(2,96,0);
  assert.equal(t.moveX,0);assert.equal(t.held('fire'),false);assert.equal(t.pointers.size,0);
});
