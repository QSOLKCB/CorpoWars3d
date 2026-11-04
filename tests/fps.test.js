// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,MISSIONS} from '../src/campaign.js';
import {createOperation,switchAgent,setTactical,command,update,shoot,moveDirect,look,reload,STEP,SCALE,eyeOf,objective} from '../src/fps.js';
import {FixedClock} from '../src/vendor/time.js';
import {rayBox,boxAt,forward} from '../src/math.js';
function fixture(){
  const g=createOperation();g.world={size:36,blocked:new Uint8Array(1296),buildings:[],seed:1};
  for(const [i,a] of g.agents.entries())Object.assign(a,{x:8.5+i*2,y:8.5,prevX:8.5+i*2,prevY:8.5,yaw:0,pitch:0});
  const e=g.guards[0];g.guards=[e];Object.assign(e,{x:8.5,y:5.5,prevX:8.5,prevY:5.5,hp:100,maxHp:100,cooldown:999,home:{x:8.5,y:5.5},think:999,path:[]});
  return g;
}
test('six contracts retain their campaign identities',()=>{assert.equal(MISSIONS.length,6);for(let i=0;i<6;i++){const g=createOperation(createCampaign(),i);assert.equal(g.mission,MISSIONS[i]);assert.equal(g.agents.length,4);assert.equal(g.controlled,0);}});
test('direct agent does not acquire or fire automatically; AI still does',()=>{
  const g=fixture();g.agents[1].x=9;g.agents[1].y=6.5;g.agents[1].cooldown=0;
  const ammo=g.agents[0].ammo;update(g,{});assert.equal(g.agents[0].ammo,ammo);assert.ok(g.agents[1].ammo<g.agents[1].magazine);
});
test('manual shot, headshot, cooldown and reload retain ammo accounting',()=>{
  const g=fixture(),a=g.agents[0],e=g.guards[0];
  assert.equal(shoot(g),true);assert.equal(e.hp,80);assert.equal(a.ammo,a.magazine-1);assert.equal(shoot(g),false);
  assert.equal(reload(g),true);assert.equal(shoot(g),false);for(let i=0;i<120;i++)update(g,{});assert.equal(a.ammo,a.magazine);
});
test('three dimensional cover blocks direct shots',()=>{
  const g=fixture();g.world.buildings.push({x:8,y:6,w:1,d:1,height:2});g.world.blocked[6*36+8]=1;
  assert.equal(shoot(g),true);assert.equal(g.guards[0].hp,100);assert.equal(g.lastShot.target,null);
});
test('a friendly blocks the ray without receiving damage or allowing penetration',()=>{
  const g=fixture();Object.assign(g.agents[1],{x:8.5,y:7.5});const hp=g.agents[1].hp;
  shoot(g);assert.equal(g.guards[0].hp,100);assert.equal(g.agents[1].hp,hp);assert.equal(g.lastShot.target,1);
});
test('looking away and aiming above a target cannot register a hit',()=>{
  for(const [yaw,pitch] of [[Math.PI,0],[0,1]]){const g=fixture();Object.assign(g.agents[0],{yaw,pitch});shoot(g);assert.equal(g.guards[0].hp,100);}
});
test('switching preserves identity, timers, health, ammunition and route',()=>{
  const g=fixture(),a=g.agents[0],route=[{x:9.5,y:8.5}];Object.assign(a,{hp:52,ammo:3,reload:.8,cooldown:.2,path:route});
  assert.equal(switchAgent(g,2),true);assert.equal(a.hp,52);assert.equal(a.ammo,3);assert.equal(a.reload,.8);assert.equal(a.path,route);
  update(g,{});assert.ok(a.x>8.5);assert.ok(a.reload<.8);assert.equal(switchAgent(g,0),true);assert.equal(g.viewId,0);
  g.agents[1].hp=0;assert.equal(switchAgent(g,1),false);assert.equal(switchAgent(g,-1),false);
});
test('tactical view gives all four agents back to the original simulation',()=>{
  const g=fixture();g.guards=[];setTactical(g,true);command(g,'move',{x:16.5,y:15.5});
  const before=g.agents.map(a=>[a.x,a.y]);for(let i=0;i<90;i++)update(g,{forward:1,fire:true});
  assert.equal(g.controlled,null);for(let i=0;i<4;i++)assert.notDeepEqual([g.agents[i].x,g.agents[i].y],before[i]);
  assert.equal(g.shots,0);setTactical(g,false);assert.equal(g.controlled,g.viewId);
});
test('follow orders route teammates and hold cancels their movement',()=>{
  const g=fixture();g.guards=[];g.agents[0].x=20;const before=g.agents[1].x;
  command(g,'follow');for(let i=0;i<120;i++)update(g,{});assert.ok(g.agents[1].x>before);
  command(g,'hold');const x=g.agents[1].x;for(let i=0;i<60;i++)update(g,{});assert.equal(g.agents[1].x,x);assert.equal(g.follow.size,0);
});
test('paused simulation freezes timers, health, movement and manual fire',()=>{
  const g=fixture();g.paused=true;const before=JSON.stringify(g.agents);for(let i=0;i<60;i++)update(g,{forward:1,fire:true});
  assert.equal(g.time,0);assert.equal(JSON.stringify(g.agents),before);assert.equal(shoot(g),false);assert.equal(reload(g),false);
  assert.equal(command(g,'move',{x:15,y:15}),true);assert.equal(g.time,0);
});
test('manual movement cannot tunnel through cover, corner tiles or district edges',()=>{
  const g=fixture(),a=g.agents[0];g.guards=[];
  for(let x=0;x<36;x++)g.world.blocked[7*36+x]=1;
  for(let i=0;i<120;i++)moveDirect(g,{forward:1,sprint:true},STEP);
  assert.ok(a.y>=8.13-1e-8);assert.ok(a.y<8.5);
  a.y=1;a.x=.5;a.yaw=-Math.PI/2;for(let i=0;i<120;i++)moveDirect(g,{forward:1},STEP);assert.ok(a.x>=.13-1e-8);
});
test('diagonal speed is normalized and invalid look input is ignored',()=>{
  const a=fixture(),b=fixture();moveDirect(a,{forward:1},.1);moveDirect(b,{forward:1,strafe:1},.1);
  assert.ok(Math.abs(Math.hypot(b.agents[0].x-8.5,b.agents[0].y-8.5)-(8.5-a.agents[0].y))<1e-12);
  look(a,NaN,0);assert.equal(a.agents[0].yaw,0);look(a,0,-1e6);assert.ok(a.agents[0].pitch<=1.35);
});
test('automatic death switch and total squad loss have bounded outcomes',()=>{
  const g=fixture();g.guards=[];g.agents[0].hp=0;update(g);assert.equal(g.viewId,1);
  for(const a of g.agents)a.hp=0;update(g);assert.equal(g.phase,'lost');
});
test('fire discipline stops autonomous triggers but permits the piloted trigger',()=>{
  const g=fixture();command(g,'fire');const before=g.agents.map(a=>a.ammo);update(g);assert.deepEqual(g.agents.map(a=>a.ammo),before);assert.equal(shoot(g),true);
});
test('ray-box slabs handle parallel axes, internal origins and maximum distance',()=>{
  const box=boxAt(0,0,0,2,2,2);assert.equal(rayBox([0,0,3],[0,0,-1],box),2);assert.equal(rayBox([0,0,0],[1,0,0],box),0);
  assert.equal(rayBox([2,0,3],[0,0,-1],box),null);assert.equal(rayBox([0,0,3],[0,0,-1],box,1),null);
  assert.deepEqual(forward(0),[0,0,-1]);assert.equal(eyeOf(fixture().agents[0])[0],8.5*SCALE);
});
test('VANILLAJS clock bounds catch-up and resets its backlog on pause',()=>{
  const clock=new FixedClock({step:STEP,maxFrame:.1,maxSteps:6});let ticks=0;const result=clock.advance(10,()=>ticks++);
  assert.equal(ticks,6);assert.ok(result.dropped>9);clock.setPaused(true);clock.advance(1,()=>ticks++);assert.equal(ticks,6);clock.setPaused(false);assert.equal(clock.accumulator,0);
});
test('all contracts can complete with squad orders and original objective rules',()=>{
  for(let index=0;index<MISSIONS.length;index++){
    const g=createOperation(createCampaign(),index);setTactical(g,true);let lastKey='',escort=false;
    // Isolate navigation/objective reachability from combat; spawned waves too.
    for(let i=0;i<24000&&g.phase==='active';i++){
      g.guards.length=0;const o=objective(g);
      if(o.key!==lastKey){command(g,'move',o.point);lastKey=o.key;}
      if(g.courier?.active&&!escort){command(g,'escort');escort=true;}
      update(g);
    }
    assert.equal(g.phase,'won',g.mission.id+' failed at '+lastKey+' / '+g.time);
  }
});
function addCourier(g,overrides={}){
  g.courier={id:300,team:'courier',active:true,x:8.5,y:7.5,prevX:8.5,prevY:7.5,
    hp:120,maxHp:120,speed:2.8,path:[],armour:0,...overrides};
  return g.courier;
}
test('released courier stops direct shots without taking player damage',()=>{
  const g=fixture(),courier=addCourier(g);
  assert.equal(shoot(g),true);assert.equal(g.lastShot.target,300);
  assert.equal(courier.hp,120);assert.equal(g.guards[0].hp,100);assert.equal(g.kills,0);
});
test('inactive or dead couriers do not block direct shots',()=>{
  for(const overrides of [{active:false},{hp:0}]){
    const g=fixture();addCourier(g,overrides);shoot(g);
    assert.equal(g.lastShot.target,g.guards[0].id);assert.equal(g.guards[0].hp,80);
  }
});
test('Follow supersedes Escort and followers stay with the piloted leader',()=>{
  const g=fixture();g.guards=[];addCourier(g,{x:20.5,y:8.5});g.exit={x:30.5,y:8.5,done:false,progress:0};
  for(const a of g.agents)a.x=8.5+a.id*.4;
  assert.equal(command(g,'escort'),true);assert.equal(command(g,'follow'),true);
  assert.equal(g.escortFollowing,false);assert.deepEqual(g.escortAgents,[]);
  for(let i=0;i<240;i++)update(g);
  for(const a of g.agents.slice(1))assert.ok(Math.hypot(a.x-8.5,a.y-8.5)<1.8,a.name);
});
test('Escort supersedes Follow only for its selected recipients',()=>{
  const g=fixture();addCourier(g);command(g,'follow');g.selected=new Set([1]);
  assert.equal(command(g,'escort'),true);assert.equal(g.follow.has(1),false);
  assert.equal(g.follow.has(2),true);assert.equal(g.follow.has(3),true);
  assert.equal(g.agents[1].command,'ESCORT');assert.deepEqual(g.escortAgents,[1]);
});
function terminalFixture(index=0){
  const g=fixture();g.mission=MISSIONS[index];g.guards=[];g.relay={x:8.5,y:8.5,done:false,progress:0};
  for(const a of g.agents.slice(1))Object.assign(a,{x:30+a.id*.5,y:30});
  return g;
}
test('a moving direct agent cannot channel a terminal, then can channel after stopping',()=>{
  const g=terminalFixture();
  for(let i=0;i<240;i++)update(g,{forward:i%2?1:-1});
  assert.equal(g.relay.done,false);assert.equal(g.relay.progress,0);
  for(let i=0;i<200;i++)update(g,{});
  assert.equal(g.relay.done,true);
});
test('direct movement also prevents hold-zone progress',()=>{
  const g=terminalFixture(3);g.relay.done=true;g.vault={x:8.5,y:8.5,done:false,progress:0};g.holdWavesSpawned=[true,true];
  for(let i=0;i<240;i++)update(g,{strafe:i%2?1:-1});
  assert.equal(g.vault.progress,0);assert.equal(g.vault.done,false);
  update(g,{});assert.ok(g.vault.progress>0);
});
test('direct motion is current-tick state, preserves interpolation and clears on AI handoff',()=>{
  const g=terminalFixture(),a=g.agents[0],start=a.y;
  update(g,{forward:1});assert.equal(a.prevY,start);assert.ok(a.y<start);assert.equal(a.directMoving,true);
  assert.equal(g.relay.progress,0);switchAgent(g,1);update(g,{});
  assert.equal(a.directMoving,false);assert.ok(g.relay.progress>0);
});
