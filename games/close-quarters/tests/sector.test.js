// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPAIGN,reachable,validateMap} from '../src/maps.js';
import {createBonusOperation,sectorWorld,SECTORS,stepBonus,
  decodeProgress,recordVictory,defaultProgress} from '../src/sector.js';
import {createOperation} from '../../../src/fps.js';
import {walkable,findPath} from '../../../src/simulation.js';
const snap=g=>({
  game:g.phase,time:g.time,agents:g.agents.map(a=>[a.x,a.y,a.hp,a.ammo,a.reload,a.cooldown]),
  guards:g.guards.map(e=>[e.x,e.y,e.hp,e.path.length,e.cooldown,e.think]),
  bonus:{...g.bonus},relay:{...g.relay},vault:{...g.vault}
});

test('eight original 24 x 24 sectors are validated by donor schema',()=>{
  assert.equal(CAMPAIGN.length,8);
  assert.equal(SECTORS.length,CAMPAIGN.length);
  for(const [i,map] of CAMPAIGN.entries()){
    assert.deepEqual(validateMap(map),[],map.name);
    assert.equal(map.tiles.length,24);
    assert.equal(map.tiles[0].length,24);
    assert.equal(SECTORS[i].enemyCount,map.enemies.length);
    assert.equal(SECTORS[i].terminals,map.terminals.length);
    const flooded=reachable(map);
    for(const p of [map.exit,...map.enemies,...map.terminals])
      assert.ok(flooded.has(p.z*24+p.x),map.name+' unreachable '+JSON.stringify(p));
  }
});
test('bounded merged rectangles cover every donor obstruction exactly once',()=>{
  for(const [i,map] of CAMPAIGN.entries()){
    const w=sectorWorld(map,i);
    assert.equal(w.size,24);
    assert.ok(w.buildings.length<24*24,'no explosion of separate meshes');
    const cover=new Uint8Array(24*24);
    for(const b of w.buildings){
      assert.ok(b.w>0&&b.d>0&&b.height>0);
      for(let y=b.y;y<b.y+b.d;y++)for(let x=b.x;x<b.x+b.w;x++)cover[y*24+x]++;
    }
    for(let y=0;y<24;y++)for(let x=0;x<24;x++){
      const solid=map.tiles[y][x]>=1&&map.tiles[y][x]<=3?1:0;
      assert.equal(w.blocked[y*24+x],solid,`sector ${i} / ${x},${y}`);
      assert.equal(cover[y*24+x],solid,'exact draw/collision cover');
    }
    assert.deepEqual(sectorWorld(map,i).buildings,w.buildings,'geometry is seeded');
  }
});
test('CorpoWars four-agent identity and authored enemy roster survive transplant',()=>{
  for(const [i,map] of CAMPAIGN.entries()){
    const g=createBonusOperation(i,'relaxed');
    assert.equal(g.phase,'active');
    assert.equal(g.world.size,24);
    assert.equal(g.guards.length,map.enemies.length);
    assert.equal(g.agents.length,4);
    assert.equal(g.controlled,0);
    assert.equal(g.relayResponseSent,true);
    assert.deepEqual(g.guards.map(e=>e.id),map.enemies.map((_,j)=>100+j));
    for(let j=0;j<map.enemies.length;j++){
      const e=g.guards[j],author=map.enemies[j];
      assert.equal(e.x,author.x+.5);assert.equal(e.y,author.z+.5);
      assert.equal(e.sourceType,author.type);
      assert.ok(walkable(g.world,e.x,e.y),map.name+' enemy inside cover');
    }
    for(const a of g.agents){
      assert.ok(walkable(g.world,a.x,a.y),'agent not in solid');
      assert.ok(findPath(g.world,a,g.exit).length,'agent can extract');
    }
    assert.equal(new Set(g.agents.map(a=>a.y*24+a.x)).size,4);
    assert.equal(g.bonus.nodes,Math.max(2,map.terminals.length));
    if(i===7)assert.equal(g.guards.some(e=>e.boss),true);
  }
});
test('underlying main game remains a 36-tile campaign; distinct save namespace',()=>{
  assert.equal(createOperation().world.size,36);
  assert.equal(createBonusOperation().world.size,24);
  assert.notEqual('corpowars-close-quarters-v1','corpowars3d-campaign-v1');
});
test('replay and ranged enemy updates are deterministic without a wall clock',()=>{
  const a=createBonusOperation(1),b=createBonusOperation(1);
  for(let i=0;i<120;i++){
    const input={forward:i<90?1:0,strafe:i%19<7?1:0,fire:i%20===0,chrono:i>20&&i<65};
    stepBonus(a,input,1/60);stepBonus(b,input,1/60);
  }
  assert.deepEqual(snap(a),snap(b));
});
test('chronopulse drains bounded reserve and does not accelerate simulations',()=>{
  const slow=createBonusOperation(0),normal=createBonusOperation(0);
  for(let i=0;i<60;i++){stepBonus(slow,{chrono:true},1/60);stepBonus(normal,{},1/60);}
  assert.ok(slow.time<normal.time);
  assert.ok(slow.bonus.chrono>0&&slow.bonus.chrono<100);
  for(let i=0;i<250;i++)stepBonus(slow,{chrono:true},1/60);
  assert.ok(slow.bonus.chrono>=0);
  assert.ok(slow.bonus.chrono<=100);
  const clock=slow.time;slow.paused=true;stepBonus(slow,{chrono:true},1/60);
  assert.equal(slow.time,clock,'pause freezes the world');
});
test('the third AFTER//ZERO relay cannot be silently skipped',()=>{
  const g=createBonusOperation(3);
  assert.ok(g.bonus.pending.length>=1);
  g.relay.done=true;g.vault.done=true;
  const before=g.vault.x+g.vault.y;
  stepBonus(g,{},1/60);
  assert.equal(g.vault.done,false);
  assert.ok(g.vault.x+g.vault.y!==before||g.bonus.cleared===1);
  assert.equal(g.bonus.cleared,1);
});
test('local-only progression validates bounds, and wins pay no double reward',()=>{
  assert.deepEqual(decodeProgress('not JSON'),defaultProgress());
  assert.deepEqual(decodeProgress('{"version":1,"unlocked":999}').unlocked,7);
  const first=recordVictory(null,0,42.5);
  assert.equal(first.unlocked,1);assert.equal(first.best[0],42.5);
  const again=recordVictory(first,0,55);
  assert.equal(again.best[0],42.5);
  assert.equal(recordVictory(first,3,21).unlocked,1,'future stage cannot unlock by arbitrary record');
  assert.equal(recordVictory(first,1,NaN).best[1],null);
  assert.equal(recordVictory(first,1,-1).best[1],null);
});
test('bonus is an offline static HTML/ESM entrypoint',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/src\/main\.js/);
  assert.doesNotMatch(html,/<script[^>]+https?:\/\//i);
  assert.doesNotMatch(source,/\b(fetch|WebSocket|EventSource)\s*\(/);
  assert.match(source,/stepBonus/);
});
