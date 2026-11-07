// SPDX-License-Identifier: Apache-2.0
// Autonomous facing and pursuit: what an approaching player sees must match the
// simulation heading, and a guard that makes contact must turn and close in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperation,update,setTactical} from '../src/fps.js';
import {Renderer} from '../src/renderer.js';
import {SoftwareRenderer} from '../src/software-renderer.js';
import {forward} from '../src/math.js';

// Open ground, one guard, VEX as the approaching player and the rest of the squad
// parked far away so only VEX can be detected.
function field({guard={},agent={}}={}) {
  const g=createOperation();g.world={size:36,blocked:new Uint8Array(1296),buildings:[],seed:1};
  for(const [i,a] of g.agents.entries())Object.assign(a,{x:2.5+i*2,y:32.5,prevX:2.5+i*2,prevY:32.5,yaw:0,pitch:0,path:[],cooldown:999});
  Object.assign(g.agents[0],{x:16.5,y:8.5,prevX:16.5,prevY:8.5},agent);
  const e=g.guards[0];g.guards=[e];
  Object.assign(e,{x:8.5,y:8.5,prevX:8.5,prevY:8.5,hp:100,maxHp:100,cooldown:999,home:{x:8.5,y:8.5},think:0,path:[],route:undefined},guard);
  setTactical(g,true);return {g,e,a:g.agents[0]};
}
const heading=yaw=>{const f=forward(yaw,0);return [f[0],f[2]];};
const towards=(from,to)=>{const dx=to.x-from.x,dy=to.y-from.y,l=Math.hypot(dx,dy);return [dx/l,dy/l];};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

// Records every emitted character part in world space for one actor.
function webglParts(actor) {
  const parts=[],batch={box:(x,y,z)=>parts.push([x,y,z])};
  Renderer.prototype.unit.call({},batch,actor,0,1,null);return parts;
}
function softwareParts(actor) {
  const parts=[];SoftwareRenderer.prototype.unit.call({box:(x,y,z)=>parts.push([x,y,z])},actor,0,1);return parts;
}

for(const [name,emit] of [['WebGL',webglParts],['software',softwareParts]]) {
  test(`${name} characters face their simulation heading in every direction`,()=>{
    const {e}=field(),base={...e,x:0,y:0,prevX:0,prevY:0};
    const north=emit({...base,yaw:0});
    for(const yaw of [Math.PI/2,Math.PI,-Math.PI/2,.7,-2.2]) {
      const turned=emit({...base,yaw}),c=Math.cos(yaw),s=Math.sin(yaw);
      assert.equal(turned.length,north.length);
      // Rotating the north-facing model by the heading: local -Z forward
      // becomes (sin yaw, -cos yaw), the same vector the FPS camera uses.
      for(let i=0;i<north.length;i++) {
        const [ox,,oz]=north[i],[x,y,z]=turned[i];
        assert.ok(Math.abs(x-(ox*c-oz*s))<1e-9&&Math.abs(z-(ox*s+oz*c))<1e-9&&y===north[i][1],`${name} part ${i} at yaw ${yaw}`);
      }
    }
    // The muzzle (the most forward part when facing north) points at an
    // observer standing east of a guard whose heading is east.
    let muzzle=0;for(let i=1;i<north.length;i++)if(north[i][2]<north[muzzle][2])muzzle=i;
    assert.ok(emit({...base,yaw:Math.PI/2})[muzzle][0]>.1);
  });
}

test('a guard engaging a stationary player turns to face them',()=>{
  for(const [ax,ay] of [[13,8.5],[4,8.5],[8.5,13],[8.5,4],[12,12]]) {
    const {g,e,a}=field({agent:{x:ax,y:ay,prevX:ax,prevY:ay}});
    e.yaw=Math.atan2(-(ax-8.5),ay-8.5); // start facing directly away
    update(g,{});
    assert.equal(e.path.length,0,'in range: the guard stands and fires');
    assert.ok(dot(heading(e.yaw),towards(e,a))>.99,`guard faces a player at ${ax},${ay}`);
  }
});

test('autonomous agents face the guard they are engaging, even while moving',()=>{
  const {g,e}=field(),b=g.agents[1];
  Object.assign(b,{x:8.5,y:13.5,prevX:8.5,prevY:13.5,cooldown:0,path:[{x:12.5,y:13.5},{x:16.5,y:13.5}]});
  e.cooldown=999;update(g,{});
  assert.ok(b.x>8.5,'still following its route');
  assert.ok(dot(heading(b.yaw),towards(b,e))>.99,'aims at the guard instead of along the route');
});

test('a patrolling guard reacts to new contact on the same tick instead of finishing its patrol leg',()=>{
  const {g,e,a}=field({guard:{think:.9,path:[{x:3.5,y:8.5}]}});
  const before=e.x;update(g,{});
  assert.ok(e.x>before,'moves towards the player, not along the old westward patrol');
  assert.ok(dot(heading(e.yaw),towards(e,a))>.99,'and faces them');
});

test('a guard part-way across a tile does not walk back to its own tile centre before chasing',()=>{
  const {g,e}=field({guard:{x:8.9,prevX:8.9}});
  for(let i=0;i<10;i++){const x=e.x;update(g,{});assert.ok(e.x>x,`tick ${i}: never steps away from the player`);}
});

test('a chasing guard re-plans when the player moves away from its goal',()=>{
  const {g,e,a}=field({agent:{x:15.5,y:8.5,prevX:15.5,prevY:8.5}});
  update(g,{});const goal=e.path.at(-1);assert.deepEqual(goal,{x:15.5,y:8.5});
  // Sidestep to a tile two rows away; the guard must not keep heading to the stale tile.
  Object.assign(a,{y:12.5,prevY:12.5});
  for(let i=0;i<30;i++)update(g,{});
  const end=e.path.at(-1);
  assert.ok(end&&Math.floor(end.y)===12,'the route now ends at the player\'s new tile');
});

test('re-planning a pursuit is bounded while the target keeps changing tiles',()=>{
  const {g,e,a}=field({agent:{x:15.5,y:4.5,prevX:15.5,prevY:4.5}});
  let plans=0,last=null;
  for(let i=0;i<60;i++){
    a.y=4.5+i*.1;a.prevY=a.y; // a new tile every ten ticks for one second
    update(g,{});if(e.path!==last&&e.path.length){plans++;last=e.path;}
  }
  assert.ok(plans>=3,'follows the moving player');
  assert.ok(plans<=1+Math.ceil(1/.25),`at most one re-plan per 0.25 s (${plans})`);
});

test('the distance early-reject relies only on hypot never undercutting its larger leg',()=>{
  // simulation.js skips pairs with |dx| or |dy| beyond a limit before Math.hypot.
  // That is exact only if hypot(dx, dy) >= max(|dx|, |dy|) on this engine.
  let s=12345;const r=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
  const values=[0,-0,1e-300,5e-324,.1,.3,1/3,6.5,9,11,36,1e300,Number.MAX_VALUE];
  for(let i=0;i<200000;i++)values.push((r()-.5)*80,(r()-.5)*Math.pow(2,Math.floor(r()*60)-30));
  for(let i=0;i+1<values.length;i++){
    const x=values[i],y=values[values.length-1-i];
    assert.ok(Math.hypot(x,y)>=Math.max(Math.abs(x),Math.abs(y)),`hypot(${x}, ${y})`);
  }
});
