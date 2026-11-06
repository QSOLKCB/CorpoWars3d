// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKINS,AGENT_SKINS,HIT_HEIGHT,skinKey,emitCharacter} from '../src/skins.js';

function parts(key,pose){
  const out=[];emitCharacter((...p)=>out.push(p),key,{gait:0,dead:false,lod:'high',flash:false,...pose});return out;
}

test('every actor maps to a distinct, known skin',()=>{
  assert.deepEqual([0,1,2,3].map(id=>skinKey({team:'agent',id})),[...AGENT_SKINS]);
  for(const type of ['guard','bulwark','marksman'])assert.equal(skinKey({team:'guard',enemyType:type}),type);
  assert.equal(skinKey({team:'guard',enemyType:'unknown'}),'guard');
  assert.equal(skinKey({team:'guard',enemyType:'witness'}),'guard');
  assert.equal(skinKey({team:'courier',id:300}),'witness');
  const looks=new Set(Object.values(SKINS).map(s=>`${s.jacket}|${s.head}|${s.weapon}`));
  assert.equal(looks.size,Object.keys(SKINS).length,'each skin has its own outfit');
});

test('standing skins stay inside the shot volume at every stride',()=>{
  for(const key of Object.keys(SKINS))for(const gait of [-1,0,1]){
    for(const [dx,y,dz,w,h,d,color,glow] of parts(key,{gait})){
      assert.ok(y-h/2>=-1e-9&&y+h/2<=HIT_HEIGHT+1e-9,`${key} part leaves 0..${HIT_HEIGHT} m: y=${y} h=${h}`);
      assert.ok(Math.abs(dx)+w/2<=.5,`${key} part too wide at dx=${dx}`);
      assert.ok(dz+d/2<=.45&&dz-d/2>=-1.1,`${key} part outside the body depth at dz=${dz}`);
      assert.ok(color.length===3&&color.every(c=>c>=0&&c<=1),`${key} colour out of range`);
      assert.ok(glow>=0&&glow<=1);
    }
  }
});

test('heads reach the headshot band used by fps.js',()=>{
  for(const key of Object.keys(SKINS)){
    const top=Math.max(...parts(key).map(([,y,,,h])=>y+h/2));
    assert.ok(top>HIT_HEIGHT*.82,`${key} head top ${top} below the headshot band`);
  }
});

test('low detail is a strict subset budget and flashing lights every part',()=>{
  for(const key of Object.keys(SKINS)){
    const high=parts(key),low=parts(key,{lod:'low'});
    assert.ok(low.length<high.length,`${key} low detail must emit fewer parts`);
    assert.ok(low.length<=15,`${key} low detail stays near the old 13-part budget (${low.length})`);
    assert.ok(parts(key,{flash:true}).every(p=>p[7]===1));
  }
});

test('fallen actors lie flat in their own colours',()=>{
  for(const key of Object.keys(SKINS)){
    const body=parts(key,{dead:true});
    assert.ok(body.length>0&&body.every(([,y,,,h])=>y+h/2<=.3));
    assert.ok(body.some(p=>p[6]===SKINS[key].jacket));
  }
});

test('emission is deterministic and the module has no ambient inputs',()=>{
  assert.deepEqual(parts('iron',{gait:.4}),parts('iron',{gait:.4}));
  const source=readFileSync(new URL('../src/skins.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(document|window|Math\.random|Date|performance|localStorage)\b/);
});

import {LUT,SLOTS,twist,seedsFor,variantCode,variantSkin,actorVariant,VARIABLE_SKINS} from '../src/skins.js';

test('skins are byte indices into one colour lookup table',()=>{
  assert.ok(LUT.length>0&&LUT.length<=256,'indices fit in a byte');
  for(const c of LUT)assert.ok(c.length===3&&c.every(v=>v>=0&&v<=1));
  for(const [key,skin] of Object.entries(SKINS)){
    assert.ok(skin.colours instanceof Uint8Array&&skin.colours.length===SLOTS.length,`${key} outfit is ${SLOTS.length} bytes`);
    SLOTS.forEach((slot,i)=>assert.equal(skin[slot],LUT[skin.colours[i]],`${key}.${slot} resolves through the LUT`));
  }
});

test('Elite-style twist is a 16-bit tribonacci step',()=>{
  assert.deepEqual(twist([0xffff,0x0002,0x0003]),[0x0002,0x0003,0x0004]);
  assert.deepEqual(seedsFor(712),seedsFor(712));
  assert.ok(seedsFor(712).every(w=>Number.isInteger(w)&&w>=0&&w<=0xffff));
});

test('crowd variants are deterministic, varied, bounded and readable',()=>{
  for(const key of VARIABLE_SKINS){
    const looks=new Set();
    for(let id=700;id<760;id++){
      const code=variantCode(key,id);
      assert.equal(code,variantCode(key,id));
      assert.equal(actorVariant(key,id),code);
      const skin=variantSkin(key,code);
      assert.equal(skin,variantSkin(key,code),'variants are cached');
      assert.equal(skin.weapon,SKINS[key].weapon);assert.equal(skin.head,SKINS[key].head);
      assert.equal(skin.accent,SKINS[key].accent,'threat accent never varies');
      looks.add(skin.colours.join(',')+skin.gear.join(','));
      const parts=[];emitCharacter((...p)=>parts.push(p),key,{gait:1,lod:'high',variant:code});
      for(const [dx,y,dz,w,h,d] of parts)assert.ok(y+h/2<=HIT_HEIGHT+1e-9&&y-h/2>=-1e-9&&Math.abs(dx)+w/2<=.5);
    }
    assert.ok(looks.size>=12,`${key}: only ${looks.size} distinct looks across 60 ids`);
  }
  for(const key of ['vex','null','echo','iron','witness'])assert.equal(actorVariant(key,3),-1,'named characters never vary');
});
