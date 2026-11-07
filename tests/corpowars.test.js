// SPDX-License-Identifier: Apache-2.0
// CorpoWars parity features: district control nodes and HQ reserve patches.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,decodeCampaign,MISSIONS,buyPatch,reservePatches,PATCH_COST,MAX_RESERVE_PATCHES,settleMission} from '../src/campaign.js';
import {createOperation,setTactical,command,update,objective} from '../src/fps.js';
import {findPath,walkable,medkit} from '../src/simulation.js';
import {captureKeys,objectiveKeys,currentObjectiveKey,capturesComplete,objectiveLabel} from '../src/objectives.js';

test('each contract requires CorpoWars\' escalating capture count on reachable, distinct street nodes',()=>{
  assert.deepEqual(MISSIONS.map(m=>m.captures.length+2),[2,3,4,5,6,7,7,7]);
  for(const [index,m] of MISSIONS.entries()){
    const g=createOperation(createCampaign(),index),keys=captureKeys(g);
    assert.equal(keys.length,m.captures.length+2);assert.equal(objectiveKeys(g).at(-1),'exit');
    if(m.kind==='escort')assert.equal(keys.at(-1),'vault','escort releases the witness after the control nodes');
    else assert.deepEqual(keys.slice(0,2),['relay','vault']);
    const seen=new Set();
    for(const key of objectiveKeys(g)){
      const p=g[key],id=`${p.x},${p.y}`;
      assert.ok(walkable(g.world,p.x,p.y),`${m.id} ${key} on the street`);
      if(key.startsWith('capture'))assert.ok(!seen.has(id),`${m.id} ${key} is distinct`);seen.add(id);
      assert.ok(findPath(g.world,g.agents[0],p).length>0,`${m.id} ${key} reachable from insertion`);
    }
    for(let i=0;i<m.captures.length;i++){
      const defender=g.guards.find(e=>e.id===500+i);
      assert.ok(defender,`${m.id} control ${i} has a defender`);assert.equal(defender.enemyType,i>1?'bulwark':'guard');
      assert.match(objectiveLabel(g,`capture${i+1}`),/^CONTROL \d$/);
    }
  }
});

test('extraction stays locked until every control node is captured in order',()=>{
  const g=createOperation(createCampaign(),2);setTactical(g,true);g.guards.length=0;
  g.relay.done=g.vault.done=true;
  for(const a of g.agents)Object.assign(a,{x:g.exit.x,y:g.exit.y,prevX:g.exit.x,prevY:g.exit.y,path:[]});
  for(let i=0;i<300;i++)update(g);
  assert.equal(g.phase,'active');assert.equal(g.extraction,0);assert.equal(currentObjectiveKey(g),'capture1');
  assert.equal(objective(g).index,2);assert.equal(objective(g).total,5);
  // Standing on the second node does not capture it out of order.
  const second=g.capture2;for(const a of g.agents)Object.assign(a,{x:second.x,y:second.y,prevX:second.x,prevY:second.y});
  for(let i=0;i<400;i++)update(g);assert.equal(second.progress,0);assert.equal(second.done,false);
  for(const key of ['capture1','capture2']){const p=g[key];for(const a of g.agents)Object.assign(a,{x:p.x,y:p.y,prevX:p.x,prevY:p.y});for(let i=0;i<400&&!p.done;i++)update(g);assert.equal(p.done,true,key);}
  assert.ok(capturesComplete(g));assert.equal(currentObjectiveKey(g),'exit');
  for(const a of g.agents)Object.assign(a,{x:g.exit.x,y:g.exit.y,prevX:g.exit.x,prevY:g.exit.y});
  for(let i=0;i<200;i++)update(g);assert.equal(g.phase,'won');
});

test('escort contracts hold the witness until the control nodes are secured',()=>{
  const index=MISSIONS.findIndex(m=>m.kind==='escort'),g=createOperation(createCampaign(),index);setTactical(g,true);g.guards.length=0;
  g.relay.done=true;const v=g.vault;
  for(const a of g.agents)Object.assign(a,{x:v.x,y:v.y,prevX:v.x,prevY:v.y,path:[]});
  for(let i=0;i<600;i++)update(g);
  assert.equal(v.progress,0);assert.equal(g.courier.active,false);assert.ok(currentObjectiveKey(g).startsWith('capture'));
});

test('lockdown contracts remain completable on Hostile with every capture',()=>{
  for(const [index,m] of MISSIONS.entries())if(m.kind==='lockdown'){
    const c=createCampaign();c.difficulty='hostile';const g=createOperation(c,index);setTactical(g,true);let last='';
    for(let i=0;i<40000&&g.phase==='active';i++){g.guards.length=0;const o=objective(g);if(o.key!==last){command(g,'move',o.point);last=o.key;}update(g);}
    assert.equal(g.phase,'won',m.id);assert.ok(g.lockdownRemaining>20,`${m.id} keeps a margin (${g.lockdownRemaining})`);
  }
});

test('reserve patches are bought, capped, used after issued patches and stay spent',()=>{
  const c=createCampaign();c.cash=PATCH_COST*20;
  for(let i=0;i<MAX_RESERVE_PATCHES;i++)assert.equal(buyPatch(c),true);
  assert.equal(buyPatch(c),false,'capped');assert.equal(reservePatches(c),MAX_RESERVE_PATCHES);
  assert.equal(c.cash,PATCH_COST*(20-MAX_RESERVE_PATCHES));
  const poor=createCampaign();poor.cash=PATCH_COST-1;assert.equal(buyPatch(poor),false);

  c.patchesBought=3;c.patchesUsed=0;
  const g=createOperation(c,0);assert.equal(g.medkits,5);assert.equal(g.reserveMedkits,3);
  g.selected=new Set([0]);
  const use=()=>{g.agents[0].hp=1;assert.equal(medkit(g),true);};
  use();use();assert.equal(g.reserveMedkits,3,'issued patches go first');
  use();assert.equal(g.reserveMedkits,2);assert.equal(g.medkits,2);
});

test('saves validate the patch ledger and older saves without it still load',()=>{
  const c=createCampaign();settleMission(c,0,'won');
  const old=JSON.parse(JSON.stringify(c));delete old.patchesBought;delete old.patchesUsed;
  assert.equal(reservePatches(decodeCampaign(JSON.stringify(old))),0);
  assert.equal(buyPatch(c),true);assert.equal(buyPatch(c),true);c.patchesUsed=1;
  const back=decodeCampaign(JSON.stringify(c));assert.equal(back.patchesBought,2);assert.equal(back.patchesUsed,1);assert.equal(back.cash,c.cash);
  for(const forged of [{...c,cash:c.cash+PATCH_COST},{...c,patchesUsed:3},{...c,patchesBought:-1},{...c,patchesBought:1.5},
    {...c,patchesBought:c.patchesBought+MAX_RESERVE_PATCHES+1,cash:c.cash-(MAX_RESERVE_PATCHES+1)*PATCH_COST}])
    assert.equal(decodeCampaign(JSON.stringify(forged)),null);
});

test('the offline cache lists every runtime module, including control-node rules',async()=>{
  const {readFileSync,readdirSync}=await import('node:fs');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const listed=new Set(JSON.parse(sw.match(/const FILES=(\[[^\]]*\])/)[1].replaceAll("'",'"')));
  const walk=dir=>readdirSync(new URL('../'+dir,import.meta.url),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
  for(const file of walk('src'))if(file.endsWith('.js'))assert.ok(listed.has('./'+file),file+' is precached');
});
