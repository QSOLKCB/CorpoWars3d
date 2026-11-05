// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,createCampaign,decodeCampaign,settleMission,missionUnlocked} from '../src/campaign.js';
import {createOperation} from '../src/fps.js';
import {CHALLENGES,challengeResults,recordChallenges} from '../src/challenges.js';
import {buildCity} from '../src/city.js';
test('expansion missions unlock sequentially without modifying the save schema',()=>{
  const c=createCampaign(),legacy=JSON.stringify(c);
  assert.ok(decodeCampaign(legacy));
  for(let i=0;i<6;i++)assert.ok(settleMission(c,i,'won')>0);
  assert.ok(missionUnlocked(c,6));assert.equal(missionUnlocked(c,7),false);
  assert.equal(settleMission(c,7,'won'),0);
  assert.equal(settleMission(c,6,'won'),8300);assert.ok(missionUnlocked(c,7));
  assert.equal(settleMission(c,7,'won'),10500);
  assert.ok(decodeCampaign(JSON.stringify(c)));
  assert.ok(decodeCampaign(legacy));
});
test('expansion cosmetics do not alter the collision mask or generated layout',()=>{
  for(const m of MISSIONS.slice(6)){
    const g=createOperation(createCampaign(),MISSIONS.indexOf(m));
    assert.equal(g.world.visualTheme,m.visualTheme);
    const blocked=Array.from(g.world.blocked);
    const first=buildCity(g.world),again=buildCity(g.world);
    assert.deepEqual(first,again);
    assert.deepEqual(Array.from(g.world.blocked),blocked);
    assert.ok(first.boxes.length>0&&first.signs.length>0);
    assert.ok(first.boxes.some(b=>b[11]>.7));
  }
});
test('additional medals never mint credits',()=>{
  const g=createOperation();g.phase='won';g.kills=0;g.difficulty={name:'Hostile'};
  assert.ok(CHALLENGES.some(x=>x.id==='ghost'));assert.ok(CHALLENGES.some(x=>x.id==='hardline'));
  const ids=challengeResults(g).filter(x=>x.earned).map(x=>x.id);
  assert.ok(ids.includes('ghost')&&ids.includes('hardline'));
  const c=createCampaign();settleMission(c,0,'won');const cash=c.cash;
  recordChallenges(c,g);assert.equal(c.cash,cash);
  const saved=decodeCampaign(JSON.stringify(c));assert.ok(saved);assert.ok(saved.challenges['breakwater:hostile'].includes('ghost'));
});
