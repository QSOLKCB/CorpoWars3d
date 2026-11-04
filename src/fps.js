// SPDX-License-Identifier: Apache-2.0
// FPS adapter over CorpoWars' original autonomous simulation. No browser globals.
import {createGame, tick, startGame, walkable, nearestWalkable, findPath,
  selectAgents, orderMove, orderAttack, stopAgents, medkit, pulse, activatePanic,
  message, objectiveDuration, orderEscort, cycleMode} from './simulation.js';
import {createCampaign} from './campaign.js';
import {clamp, forward, rayBox, boxAt} from './math.js';
export const SCALE = 2.5, STEP = 1/60, RADIUS = .13;
export const COLORS = [[.35,.93,.82],[.98,.71,.29],[.59,.72,1],[.91,.55,.40]];
export function createOperation(campaign=createCampaign(), index=campaign.mission) {
  const g=createGame(undefined,campaign,index);
  Object.assign(g,{controlled:0,viewId:0,tactical:false,follow:new Set(),followThink:0,
    hit:0,recoil:0,ads:0,tracers:[],lastShot:null,shots:0});
  for(const a of g.agents)Object.assign(a,{yaw:0,pitch:0,elevation:0,vy:0,stance:'stand',command:'HOLD',directMoving:false});
  for(const e of g.guards)e.yaw=0;
  startGame(g);return g;
}
export function activeAgent(g){return g.agents[g.viewId];}
export function switchAgent(g,id) {
  const a=g.agents[id];
  if(!a||a.hp<=0||!Number.isInteger(id))return false;
  g.viewId=id;g.controlled=g.tactical?null:id;g.ads=0;g.recoil=0;
  return true;
}
export function nextAgent(g) {
  for(let i=1;i<=4;i++){const id=(g.viewId+i)%4;if(g.agents[id].hp>0)return switchAgent(g,id);}
  return false;
}
export function setTactical(g,value) {
  g.tactical=Boolean(value);g.controlled=g.tactical?null:g.viewId;g.ads=0;
}
export function look(g,dx,dy,sensitivity=.0022,invert=false) {
  const a=activeAgent(g);
  if(!a||g.paused||g.tactical||!Number.isFinite(dx)||!Number.isFinite(dy))return;
  const factor=sensitivity*(1-g.ads*.55);
  a.yaw=(a.yaw+dx*factor)%(2*Math.PI);
  a.pitch=clamp(a.pitch-dy*factor*(invert?-1:1),-1.35,1.35);
}
export function eyeOf(a){return [a.x*SCALE,(a.stance==='crouch'?1.05:1.65)+(a.elevation||0),a.y*SCALE];}
export function buildingBox(b){return {min:[b.x*SCALE,0,b.y*SCALE],max:[(b.x+b.w)*SCALE,4+b.height*3.8,(b.y+b.d)*SCALE]};}
// Retain one scratch box, as VANILLAJS retains typed upload capacity. This pure,
// synchronous trace never exposes the workspace; every geometry field is read
// fresh, so terrain edits and replacement worlds cannot use stale cover.
const coverScratch={min:[0,0,0],max:[0,0,0]};
export function traceCover(g,origin,direction,max=100) {
  let t=max;const box=coverScratch;
  for(const b of g.world.buildings){
    box.min[0]=b.x*SCALE;box.min[2]=b.y*SCALE;
    box.max[0]=(b.x+b.w)*SCALE;box.max[1]=4+b.height*3.8;box.max[2]=(b.y+b.d)*SCALE;
    const hit=rayBox(origin,direction,box,t);if(hit!==null)t=Math.min(t,hit);
  }
  return t;
}
export function aimPoint(g) {
  const a=activeAgent(g),origin=eyeOf(a),dir=forward(a.yaw,a.pitch);
  let t=traceCover(g,origin,dir,55);
  if(dir[1]<-.001)t=Math.min(t,-origin[1]/dir[1]);
  t=Math.max(0,t-.4);
  return {x:clamp((origin[0]+dir[0]*t)/SCALE,.5,g.world.size-.5),
    y:clamp((origin[2]+dir[2]*t)/SCALE,.5,g.world.size-.5)};
}
export function reload(g) {
  const a=activeAgent(g);
  if(g.paused||g.phase!=='active'||!a||a.hp<=0||a.reload>0||a.ammo===a.magazine)return false;
  a.reload=a.reloadTime;return true;
}
export function shoot(g) {
  const a=activeAgent(g);
  if(g.paused||g.phase!=='active'||g.tactical||!a||a.hp<=0||a.cooldown>0||a.reload>0||a.ammo<1)return false;
  const origin=eyeOf(a),dir=forward(a.yaw,a.pitch),max=Math.max(a.range,16)*SCALE;
  let nearest=traceCover(g,origin,dir,max),target=null,headshot=false;
  // Friends absorb the trace without taking damage; cover always wins equal ties.
  const agentCount=g.agents.length,guardCount=g.guards.length,total=agentCount+guardCount+(g.courier?.active&&g.courier.hp>0?1:0);
  for(let i=0;i<total;i++) {
    const unit=i<agentCount?g.agents[i]:i<agentCount+guardCount?g.guards[i-agentCount]:g.courier;
    if(unit===a||unit.hp<=0)continue;
    const h=unit.stance==='crouch'?1.3:1.9,base=unit.elevation||0;
    const hit=rayBox(origin,dir,boxAt(unit.x*SCALE,base+h/2,unit.y*SCALE,.6,h,.6),nearest);
    if(hit!==null&&hit<nearest){nearest=hit;target=unit;headshot=origin[1]+dir[1]*hit>base+h*.82;}
  }
  a.ammo--;a.cooldown=a.interval;g.shots++;g.recoil=1;g.alert=10;
  const point=origin.map((n,i)=>n+dir[i]*nearest);
  g.tracers.push({origin:[origin[0]+Math.cos(a.yaw)*.18,origin[1]-.17,origin[2]+Math.sin(a.yaw)*.18],point,life:.085});
  if(g.tracers.length>32)g.tracers.shift();
  g.lastShot={target:target?.id??null,headshot,point};
  g.events.push({type:'shot',team:'agent',manual:true});
  if(target?.team==='guard') {
    const damage=Math.max(1,Math.round(a.damage*(headshot?2:1)*(1-target.armour)));
    target.hp=Math.max(0,target.hp-damage);g.hit=.16;
    g.events.push({type:'hit',headshot});
    if(!target.hp){target.path=[];g.kills++;message(g,'Security unit neutralised.');}
  }
  return true;
}
function freeAt(world,x,y) {
  return walkable(world,x-RADIUS,y-RADIUS)&&walkable(world,x+RADIUS,y-RADIUS)&&
    walkable(world,x-RADIUS,y+RADIUS)&&walkable(world,x+RADIUS,y+RADIUS);
}
export function moveDirect(g,input,dt) {
  const a=activeAgent(g);if(!a||a.hp<=0||g.controlled!==a.id)return;
  const oldX=a.x,oldY=a.y,oldElevation=a.elevation;
  a.stance=input.crouch?'crouch':'stand';
  let f=clamp(input.forward||0,-1,1),s=clamp(input.strafe||0,-1,1),length=Math.hypot(f,s);
  if(length>1){f/=length;s/=length;}
  if(length>0) {
    // Taking the sticks overrides only this agent's route. Other orders persist.
    a.path=[];a.target=null;a.command='DIRECT';g.follow.delete(a.id);
    const speed=a.speed*(input.crouch?.42:input.sprint?1.35:1)*(1-g.ads*.35);
    const dx=(Math.sin(a.yaw)*f+Math.cos(a.yaw)*s)*speed*dt;
    const dy=(-Math.cos(a.yaw)*f+Math.sin(a.yaw)*s)*speed*dt;
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.08));
    for(let i=0;i<steps;i++){
      if(freeAt(g.world,a.x+dx/steps,a.y))a.x+=dx/steps;
      if(freeAt(g.world,a.x,a.y+dy/steps))a.y+=dy/steps;
    }
  }
  if(input.jump&&a.elevation===0){a.vy=4.3;}
  a.elevation=Math.max(0,a.elevation+a.vy*dt);a.vy-=11*dt;
  if(a.elevation===0)a.vy=0;
  a.directMoving=a.x!==oldX||a.y!==oldY||a.elevation!==oldElevation||a.elevation>0;
}
export function command(g,kind,point=aimPoint(g)) {
  if(g.phase!=='active')return false;
  const ids=[...g.selected].filter(id=>g.agents[id]?.hp>0);
  if(!ids.length)return false;
  if(kind==='heal')return medkit(g);
  if(kind==='emp')return pulse(g);
  if(kind==='panic')return activatePanic(g);
  if(kind==='escort'){
    const ok=orderEscort(g);
    if(ok)for(const id of ids){g.follow.delete(id);g.agents[id].command='ESCORT';}
    return ok;
  }
  if(kind==='mode')return cycleMode(g);
  if(kind==='fire'){g.holdFire=!g.holdFire;message(g,g.holdFire?'Squad: hold fire.':'Squad: weapons free.','order');return true;}
  if(kind==='follow'){
    g.escortFollowing=false;g.escortAgents=[];
    for(const id of ids)if(id!==g.viewId){g.follow.add(id);g.agents[id].command='FOLLOW';}
    g.followThink=0;message(g,'Squad: following the active agent.','order');return true;
  }
  for(const id of ids)g.follow.delete(id);
  if(kind==='hold'){stopAgents(g);for(const id of ids)g.agents[id].command='HOLD';return true;}
  if(kind==='attack') {
    if(!point||!Number.isInteger(point.id))return false;
    const ok=orderAttack(g,point.id);if(ok)for(const id of ids)g.agents[id].command='ATTACK';return ok;
  }
  if(kind==='move'){
    const ok=orderMove(g,point.x,point.y);if(ok)for(const id of ids)g.agents[id].command='MOVE';return ok;
  }
  return false;
}
export function selectSquad(g,ids){selectAgents(g,ids);}
function updateFollow(g,dt) {
  if(!g.follow.size)return;
  g.followThink-=dt;if(g.followThink>0)return;g.followThink=.6;
  const leader=activeAgent(g),used=new Set();
  for(const id of g.follow){
    const a=g.agents[id];if(!a||a.hp<=0||a.id===g.controlled||a===leader)continue;
    if(Math.hypot(a.x-leader.x,a.y-leader.y)<1.8){a.path=[];continue;}
    const dest=nearestWalkable(g.world,leader.x+((id%2)*2-1)*.8,leader.y+1,used);
    if(dest){used.add(Math.floor(dest.y)*g.world.size+Math.floor(dest.x));a.path=findPath(g.world,a,dest);a.target=null;}
  }
}
export function update(g,input={},dt=STEP) {
  if(g.paused||g.phase!=='active'||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);updateFollow(g,dt);
  // The core captures previous poses before this control stage, then evaluates
  // combat and objectives against the resulting current-tick movement.
  tick(g,dt,()=>{if(!g.tactical)moveDirect(g,input,dt);});
  if(g.phase!=='active')return;
  if(activeAgent(g).hp<=0){nextAgent(g);input={};}
  if(!g.tactical){
    g.ads=clamp(g.ads+((input.ads?1:0)-g.ads)*Math.min(1,dt*16),0,1);
    if(input.fire)shoot(g);
  }
  for(const a of [...g.agents,...g.guards]){
    if(a.id===g.controlled)continue;
    const dx=a.x-a.prevX,dy=a.y-a.prevY;
    if(dx*dx+dy*dy>1e-8)a.yaw=Math.atan2(dx,-dy);
    else if(a.target!=null){const t=g.guards.find(e=>e.id===a.target);if(t)a.yaw=Math.atan2(t.x-a.x,a.y-t.y);}
    // A released agent settles safely to ground before its next direct view.
    if(a.elevation>0){a.elevation=Math.max(0,a.elevation+(a.vy||0)*dt);a.vy=(a.vy||0)-11*dt;if(!a.elevation)a.vy=0;}
  }
  g.hit=Math.max(0,g.hit-dt);g.recoil=Math.max(0,g.recoil-dt*6);
  for(let i=g.tracers.length-1;i>=0;i--)if((g.tracers[i].life-=dt)<=0)g.tracers.splice(i,1);
}
export function objective(g) {
  const key=!g.relay.done?'relay':!g.vault.done?'vault':'exit';
  return {key,point:g[key],label:key==='exit'?'EXTRACT ALL SURVIVORS':g.mission.objectives[key==='relay'?0:1],
    fraction:clamp((key==='exit'?g.extraction:g[key].progress)/objectiveDuration(g,key),0,1)};
}
