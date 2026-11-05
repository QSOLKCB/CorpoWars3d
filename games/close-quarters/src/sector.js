// SPDX-License-Identifier: Apache-2.0
// Close Quarters: AFTER//ZERO's exact tile/enemy placement on the CorpoWars3d
// squad simulation. Pure adapter; no DOM, network, clocks, or ambient randomness.
import {CAMPAIGN, validateMap} from './maps.js';
import {createCampaign, DIFFICULTIES, ENEMY_TYPES} from '../../../src/campaign.js';
import {createOperation, update} from '../../../src/fps.js';
import {nearestWalkable, random} from '../../../src/simulation.js';

export const SECTORS = CAMPAIGN.map((m, i) => Object.freeze({
  index:i, name:m.name, subtitle:m.subtitle, brief:m.brief,
  enemyCount:m.enemies.length, terminals:m.terminals.length, palette:m.palette
}));
export const PROGRESS_KEY = 'corpowars-close-quarters-v1';
const MAX_TIME = 36000;
const center = p => ({x:p.x + .5, y:p.z + .5});
const key = (x,y,size) => Math.floor(y)*size+Math.floor(x);

export function sectorWorld(map, index=0) {
  const errors=validateMap(map);
  if(errors.length)throw new Error('Invalid donor map: '+errors.join('; '));
  const n=map.tiles.length, blocked=new Uint8Array(n*n), seen=new Uint8Array(n*n);
  const buildings=[], rng=random(0xC0A0B0+index*131);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const t=map.tiles[y][x];
    if(t>=1&&t<=3)blocked[y*n+x]=1;
  }
  // Exact rectangle covering: every solid donor tile is represented once;
  // tile type 4 stays walkable (AFTER//ZERO's non-solid hazard floor).
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const t=map.tiles[y][x],at=y*n+x;
    if(t<1||t>3||seen[at])continue;
    let w=1,d=1;
    while(x+w<n&&map.tiles[y][x+w]===t&&!seen[y*n+x+w])w++;
    outer:while(y+d<n){
      for(let dx=0;dx<w;dx++)if(map.tiles[y+d][x+dx]!==t||seen[(y+d)*n+x+dx])break outer;
      d++;
    }
    for(let dy=0;dy<d;dy++)for(let dx=0;dx<w;dx++)seen[(y+dy)*n+x+dx]=1;
    const height=t===2?1.2+rng()*.5:t===3?3.7+rng()*1.5:2.1+rng()*1.5;
    buildings.push({x,y,w,d,height,tone:.16+rng()*.8,sign:buildings.length%8});
  }
  return {size:n,blocked,buildings,seed:0xC0A0B0+index*131,
    theme:['cinder','glacier','orchid','acid'][map.palette]};
}

function createGuard(p,id,difficulty) {
  const role=p.type==='heavy'||p.type==='architect'?'bulwark':p.type==='runner'?'guard':'guard';
  const type=ENEMY_TYPES[role],boss=p.type==='architect';
  const hp=Math.round(difficulty.hp*type.hp*(boss?3:1));
  const c=center(p);
  return {id,x:c.x,y:c.y,prevX:c.x,prevY:c.y,home:{...c},
    team:'guard',enemyType:role,sourceType:p.type,boss,
    hp,maxHp:hp,speed:difficulty.speed*type.speed*(p.type==='runner'?1.25:1),
    damage:difficulty.damage*type.damage*(boss?1.25:1),
    interval:difficulty.interval*type.interval,
    range:type.range,detection:type.detection,armour:type.armour,
    cooldown:.8,path:[],target:null,think:0,stun:0,fear:0,patrol:0,yaw:0};
}
export function createBonusOperation(index=0, difficultyName='relaxed') {
  if(!Number.isInteger(index)||index<0||index>=CAMPAIGN.length)throw new RangeError('Unknown compact sector');
  if(!Object.hasOwn(DIFFICULTIES,difficultyName))throw new RangeError('Unknown difficulty');
  const map=CAMPAIGN[index],campaign=createCampaign();
  campaign.difficulty=difficultyName;
  // Earned starting kit, distinct from the main game's economy and save file.
  if(index>=1)campaign.loadout[1]='owen';
  if(index>=3)campaign.loadout[0]='aug';
  if(index>=4)campaign.loadout[3]='shotgun';
  if(index>=6)campaign.loadout[2]='aug';
  if(index>=3)campaign.research.push('med1');
  if(index>=5)campaign.research.push('head');
  if(index>=6)campaign.research.push('panic1');
  const g=createOperation(campaign,0);
  g.world=sectorWorld(map,index);
  const points=map.terminals.map(center);
  if(points.length<1)throw new Error('Sector must have a relay');
  // Sector 0 has one relay: its first original pickup becomes the data cache.
  // Every additional authored relay in later sectors is a required objective.
  if(points.length===1)points.push(center(map.pickups[0]));
  const relay=points[0],vault=points[1];
  g.mission={id:'compact-'+index,name:map.name,district:map.name,
    brief:map.brief,seed:g.world.seed,layout:'donor-'+index,
    spawn:[map.spawn.x+.5,map.spawn.z+.5],exit:[map.exit.x+.5,map.exit.z+.5],
    relay:[relay.x,relay.y],vault:[vault.x,vault.y],
    kind:'compact',relayDuration:2.5,vaultDuration:3,
    labels:['RELAY','DATA NODE'],objectives:['Sever the uplink','Extract the stolen data'],
    reinforcements:[],reward:0,parTime:65+index*9};
  g.missionIndex=index;
  g.guards=map.enemies.map((e,i)=>createGuard(e,100+i,g.difficulty));
  g.relay={...relay,progress:0,done:false};
  g.vault={...vault,progress:0,done:false};
  g.exit={...center(map.exit),progress:0,done:false};
  g.relayResponseSent=true; // Exact donor roster: no default 36x36-city patrol injections.
  g.cityPatrols=0;g.holdWavesSpawned=[];g.holdContested=false;
  g.log=[];g.events=[];g.effects=[];g.tracers=[];g.kills=0;g.time=0;g.extraction=0;
  const occupied=new Set(g.guards.map(e=>key(e.x,e.y,g.world.size)));
  // Put all four agents near the authored AFTER//ZERO insertion, never in cover.
  const positions=[[0,0],[1,0],[0,1],[-1,0]];
  for(const [i,a] of g.agents.entries()){
    const [dx,dy]=positions[i];
    const at=nearestWalkable(g.world,map.spawn.x+dx+.5,map.spawn.z+dy+.5,occupied);
    if(!at)throw new Error('No room to deploy the full squad');
    Object.assign(a,{x:at.x,y:at.y,prevX:at.x,prevY:at.y,
      yaw:map.spawn.yaw,pitch:0,elevation:0,vy:0,
      path:[],target:null,command:'HOLD'});
    occupied.add(key(at.x,at.y,g.world.size));
  }
  g.selected=new Set([0,1,2,3]);g.viewId=0;g.controlled=0;
  g.bonus={sector:index,source:'AFTER-ZERO',nodes:points.length,
    pending:points.slice(2).map(p=>({...p})),cleared:0,
    chrono:100,chronoActive:false,chronoSeconds:0};
  return g;
}

export function stepBonus(g,input={},dt=1/60) {
  if(g.phase!=='active'||g.paused||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);
  const b=g.bonus,slow=Boolean(input.chrono)&&b.chrono>0&&!g.tactical;
  b.chronoActive=slow;
  b.chrono=Math.max(0,Math.min(100,b.chrono+(slow?-30:10)*dt));
  if(slow)b.chronoSeconds+=dt;
  update(g,input,dt*(slow?.42:1));
  if(g.vault.done&&b.pending.length){
    b.cleared++;
    const next=b.pending.shift();
    g.vault={...next,progress:0,done:false};
    g.extraction=0;
    g.mission.objectives[1]=`Purge data node ${b.cleared+2} / ${b.nodes}`;
    g.log.unshift({text:`Data node transferred. ${b.pending.length+1} remaining.`,kind:'objective',time:g.time});
    g.log.length=Math.min(g.log.length,5);
  }
}

export function decodeProgress(raw) {
  let data;
  try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch{return defaultProgress();}
  if(!data||data.version!==1||!Number.isInteger(data.unlocked))return defaultProgress();
  const unlocked=Math.max(0,Math.min(CAMPAIGN.length-1,data.unlocked));
  const best=Array.from({length:CAMPAIGN.length},(_,i)=>{
    const n=data.best?.[i];
    return i<=unlocked&&typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=MAX_TIME?n:null;
  });
  return {version:1,unlocked,best};
}
export function defaultProgress(){return {version:1,unlocked:0,best:Array(CAMPAIGN.length).fill(null)};}
export function recordVictory(raw,index,time) {
  const p=decodeProgress(raw);
  if(!Number.isInteger(index)||index<0||index>p.unlocked||index>=CAMPAIGN.length||
      !Number.isFinite(time)||time<0||time>MAX_TIME)return p;
  p.best[index]=p.best[index]===null?time:Math.min(p.best[index],time);
  p.unlocked=Math.min(CAMPAIGN.length-1,Math.max(p.unlocked,index+1));
  return p;
}
