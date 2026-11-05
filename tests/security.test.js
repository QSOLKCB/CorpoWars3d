// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,MISSIONS} from '../src/campaign.js';
import {createOperation,command,update,STEP,buildingBox,traceCover,SCALE} from '../src/fps.js';
import {lineOfSight,walkable,objectiveDuration} from '../src/simulation.js';
import {rayBox,forward} from '../src/math.js';
function panicFixture(research=[]){
  const c=createCampaign();c.research=research;const g=createOperation(c);
  g.world={size:36,blocked:new Uint8Array(1296),buildings:[],seed:1};g.holdFire=true;g.selected=new Set([0]);
  g.agents.forEach((a,i)=>Object.assign(a,{x:10+i,y:10,prevX:10+i,prevY:10}));
  g.guards=[g.guards[0]];Object.assign(g.guards[0],{x:10,y:6,home:{x:10,y:6},speed:0,cooldown:999,think:999,path:[]});return g;
}
test('Panic is one manual burst with full downtime after effect expiration',()=>{
  for(const research of [[],['panic1'],['panic1','panic2','head']]){
    const g=panicFixture(research);assert.equal(command(g,'panic'),true);
    const duration=g.panicDuration;assert.equal(g.guards[0].fear,duration);
    assert.equal(g.panicCooldown,duration+g.panicRecharge);
    for(let i=0;i<Math.ceil(duration/STEP)+1;i++){assert.equal(command(g,'panic'),false);update(g);}
    assert.equal(g.guards[0].fear,0);assert.ok(g.panicCooldown>g.panicRecharge-.1);
    assert.equal(g.metrics.panicBursts,1);
    for(let i=0;i<Math.ceil(g.panicRecharge/STEP)+2;i++)update(g);
    assert.equal(g.panicCooldown,0);assert.equal(g.metrics.panicBursts,1);assert.equal(g.guards[0].fear,0);
    assert.equal(command(g,'panic'),true);assert.equal(g.metrics.panicBursts,2);
  }
});
test('Panic cannot be pre-armed, used paused or reset by changing selection',()=>{
  const g=panicFixture(),enemy=g.guards[0];enemy.x=30;
  assert.equal(command(g,'panic'),true);assert.equal(enemy.fear,0);enemy.x=10;update(g);assert.equal(enemy.fear,0);
  g.selected=new Set([1]);assert.equal(command(g,'panic'),false);
  const before=g.panicCooldown;g.paused=true;update(g);assert.equal(g.panicCooldown,before);
  const fresh=panicFixture();fresh.paused=true;assert.equal(command(fresh,'panic'),false);assert.equal(fresh.metrics.panicBursts,0);
});
test('Panic only affects living hostiles in range and line of sight of selected agents',()=>{
  const g=panicFixture();g.world.blocked[8*36+10]=1;
  assert.equal(command(g,'panic'),true);assert.equal(g.guards[0].fear,0);
  const empty=panicFixture();empty.selected.clear();assert.equal(command(empty,'panic'),false);assert.equal(empty.panicCooldown,0);
});
test('all districts have deterministic street patrols outside insertion area',()=>{
  for(const difficulty of ['relaxed','hostile'])for(let i=0;i<MISSIONS.length;i++){
    const c=createCampaign();c.difficulty=difficulty;const g=createOperation(c,i),again=createOperation(c,i),expected=difficulty==='relaxed'?8:12;
    assert.equal(g.cityPatrols,expected);assert.deepEqual(g.guards,again.guards);
    assert.equal(new Set(g.guards.map(e=>e.id)).size,g.guards.length);
    for(const e of g.guards.filter(e=>e.id>=600)){
      assert.equal(walkable(g.world,e.x,e.y),true);assert.ok(e.path.length>0);
      assert.ok(g.agents.every(a=>Math.hypot(a.x-e.x,a.y-e.y)>=13));
      for(const p of e.route)assert.ok(g.agents.every(a=>Math.hypot(a.x-p.x,a.y-p.y)>=12));
    }
  }
});
test('relay response is bounded, once-only and cannot spawn in squad sight',()=>{
  const g=createOperation();g.guards=[];g.holdFire=true;
  Object.assign(g.agents[0],{x:g.relay.x,y:g.relay.y});g.relay.progress=objectiveDuration(g,'relay')-STEP/2;
  update(g);assert.equal(g.relayResponseSent,true);assert.ok(g.guards.length>0&&g.guards.length<=4);
  for(const e of g.guards){assert.ok(g.agents.every(a=>Math.hypot(a.x-e.x,a.y-e.y)>=10&&!lineOfSight(g.world,a,e)));}
  const ids=g.guards.map(e=>e.id);for(let i=0;i<60;i++)update(g);assert.deepEqual(g.guards.map(e=>e.id),ids);
});
test('retained cover workspace matches fresh traces, including live geometry edits',()=>{
  const g=createOperation();
  const reference=(origin,dir,max)=>{let t=max;for(const b of g.world.buildings){const box={min:[b.x*SCALE,0,b.y*SCALE],max:[(b.x+b.w)*SCALE,4+b.height*3.8,(b.y+b.d)*SCALE]};const hit=rayBox(origin,dir,box,t);if(hit!==null)t=Math.min(t,hit);}return t;};
  for(let i=0;i<2000;i++){const origin=[(i*17%90),1+i%18,(i*29%90)],dir=forward(i*.121,(i%21-10)*.09);assert.equal(traceCover(g,origin,dir,90),reference(origin,dir,90));}
  const b=g.world.buildings[0];let previous=buildingBox(b);
  for(const key of ['x','y','w','d','height']){b[key]+=.2;const next=buildingBox(b);assert.notDeepEqual(next,previous);previous=next;const o=[b.x*SCALE-2,1,b.y*SCALE+.1],d=[1,0,0];assert.equal(traceCover(g,o,d,90),reference(o,d,90));}
});
