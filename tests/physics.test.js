// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {ballisticStep,JUMP_IMPULSE,GRAVITY} from '../src/physics.js';
import {Batch} from '../src/renderer.js';
import {buildCity} from '../src/city.js';
import {createWorld} from '../src/simulation.js';
test('ballistic trajectory is invariant under a split integration interval',()=>{
  for(const [y,v,dt] of [[0,JUMP_IMPULSE,1/60],[.4,2.1,.05],[1,-2,.01]]){
    const whole=ballisticStep(y,v,dt);
    const half=ballisticStep(y,v,dt/2);const split=ballisticStep(half.elevation,half.velocity,dt/2);
    assert.ok(Math.abs(whole.elevation-split.elevation)<1e-12);
    assert.ok(Math.abs(whole.velocity-split.velocity)<1e-12);
  }
});
test('ballistic motion lands exactly on ground and cannot burrow',()=>{
  let y=0,v=JUMP_IMPULSE,peak=0;
  for(let i=0;i<180;i++){
    const next=ballisticStep(y,v,1/60);y=next.elevation;v=next.velocity;peak=Math.max(peak,y);assert.ok(y>=0);
  }
  assert.ok(peak>.7&&peak<1);assert.equal(y,0);assert.equal(v,0);
  assert.deepEqual(ballisticStep(0,0,.1),{elevation:0,velocity:0});
  assert.throws(()=>ballisticStep(0,JUMP_IMPULSE,Infinity),RangeError);
  assert.equal(GRAVITY,11);
});
test('rotation cache retains exact instance data and clears per batch',()=>{
  const gl={createBuffer:()=>({})},batch=new Batch(gl,1);
  const angles=[0,0,.5,.5,-0,0,Math.PI/3,Math.PI/3];
  for(const angle of angles)batch.box(1,2,3,4,5,6,[.1,.2,.3],.6,angle);
  assert.equal(batch.count,angles.length);
  assert.equal(batch.rotationEvaluations,4);
  for(let i=0;i<angles.length;i++){
    const offset=i*12;
    assert.equal(batch.data[offset+9],Math.fround(Math.cos(angles[i])));
    assert.ok(Object.is(batch.data[offset+10],Math.fround(Math.sin(angles[i]))));
  }
  assert.ok(batch.data.length>=angles.length*12);
  batch.clear();assert.equal(batch.count,0);assert.equal(batch.rotationEvaluations,0);
  batch.box(0,0,0,1,1,1,[1,1,1],0,.5);assert.equal(batch.rotationEvaluations,2);
});

test('encoded static city geometry retains prior packed float32 instance parity',()=>{
  const world=createWorld(7229,3),boxes=buildCity(world).boxes,gl={createBuffer:()=>({})};
  const old=new Batch(gl,boxes.length),packed=new Batch(gl,boxes.length);
  for(const v of boxes){
    old.box(v[0],v[1],v[2],v[3],v[4],v[5],v.slice(6,9),v[11],Math.atan2(v[10],v[9]));
    packed.encoded(v);
  }
  assert.equal(old.count,packed.count);
  assert.deepEqual(packed.data.subarray(0,packed.count*12),old.data.subarray(0,old.count*12));
  assert.throws(()=>packed.encoded([1,2,3]),RangeError);
});
