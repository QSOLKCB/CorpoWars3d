// SPDX-License-Identifier: Apache-2.0
// Close Quarters: standalone UI, shared CorpoWars3d renderer and pure squad FPS.
import {Renderer} from '../../../src/renderer.js';
import {Sound} from '../../../src/audio.js';
import {activeAgent,nextAgent,switchAgent,setTactical,selectSquad,
  command,objective,look,reload,STEP} from '../../../src/fps.js';
import {visibleGuard} from '../../../src/simulation.js';
import {SECTORS,createBonusOperation,stepBonus,decodeProgress,
  recordVictory,PROGRESS_KEY} from './sector.js';
import {drawTactical,mapCoordinates} from './map.js';

const $=id=>document.getElementById(id),canvas=$('view');
const sound=new Sound(),held=new Set();
let game=null,renderer=null,progress=decodeProgress(readProgress());
let sector=0,difficulty='relaxed',active=false,paused=false,finished=false;
let previous=null,debt=0,uiDebt=0,mouseButtons=0,pendingFire=false,pendingJump=false;
let hadLock=false,firstCapture=false,mouseAvailable=true;
function readProgress(){try{return localStorage.getItem(PROGRESS_KEY);}catch{return null;}}
function saveProgress(){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));return true;}catch{return false;}}
function clearInput(){held.clear();mouseButtons=0;pendingFire=false;pendingJump=false;debt=0;}
function notify(text){$('notification').textContent=text;}
function renderSectors(){
  const list=$('sectorList');list.replaceChildren();
  for(const s of SECTORS){
    const b=document.createElement('button');
    b.className='sector'+(sector===s.index?' selected':'');
    b.disabled=s.index>progress.unlocked;b.type='button';
    const small=document.createElement('span');
    small.textContent=String(s.index+1).padStart(2,'0')+' / '+s.subtitle;
    const heading=document.createElement('strong');heading.textContent=s.name;
    const detail=document.createElement('span');
    detail.textContent=s.index>progress.unlocked?'LOCKED':s.enemyCount+' HOSTILES · '+s.terminals+' UPLINKS'+
      (progress.best[s.index]===null?'':' · BEST '+progress.best[s.index].toFixed(1)+'s');
    b.append(small,heading,detail);
    b.addEventListener('click',()=>{sector=s.index;renderSectors();});
    list.append(b);
  }
  $('sectorBrief').textContent=SECTORS[sector].brief;
  $('saveNote').textContent='PROGRESS / '+(progress.unlocked+1)+' OF '+SECTORS.length+' SECTORS AVAILABLE · LOCAL ONLY';
}
function enterHome(){
  active=false;paused=false;finished=false;hadLock=false;clearInput();sound.stopMusic();
  if(game)game.paused=true;
  document.exitPointerLock?.();
  $('home').hidden=false;$('hud').hidden=true;$('mapPanel').hidden=true;
  $('pausePanel').hidden=true;$('resultPanel').hidden=true;
  renderSectors();
}
function begin(index=sector){
  if(!Number.isInteger(index)||index>progress.unlocked||index<0)return;
  sector=index;difficulty=$('difficulty').value;
  try{
    game=createBonusOperation(index,difficulty);
    if(!renderer)renderer=new Renderer(canvas,game.world);
    else renderer.setWorld(game.world);
  }catch(e){$('fatal').hidden=false;$('fatalText').textContent=String(e);return;}
  active=true;paused=false;finished=false;previous=null;debt=0;uiDebt=1;
  clearInput();hadLock=false;firstCapture=false;
  $('home').hidden=true;$('hud').hidden=false;$('mapPanel').hidden=true;
  $('pausePanel').hidden=true;$('resultPanel').hidden=true;
  $('sectorTitle').textContent=SECTORS[index].name;
  sound.start();sound.setVolume(.32);sound.setMusicVolume(.10);sound.play('start');
  renderHUD();drawTactical(game,$('miniMap'));
  canvas.focus({preventScroll:true});requestCapture();
}
function requestCapture(){
  if(!active||game.tactical||paused||document.pointerLockElement===canvas)return;
  try{const result=canvas.requestPointerLock?.();result?.catch?.(()=>{mouseAvailable=false;notify('POINTER LOCK DENIED · USE ARROW KEYS TO AIM');});}
  catch{mouseAvailable=false;notify('POINTER LOCK UNAVAILABLE · USE ARROW KEYS TO AIM');}
}
function setPause(value){
  if(!active||finished)return;
  paused=Boolean(value);game.paused=paused;clearInput();
  $('pausePanel').hidden=!paused;
  if(paused){hadLock=false;document.exitPointerLock?.();sound.stopMusic();}
  else if(!game.tactical){canvas.focus({preventScroll:true});requestCapture();}
}
function toggleMap(value=!game.tactical){
  if(!active||paused||finished)return;
  const open=Boolean(value);setTactical(game,open);clearInput();
  $('mapPanel').hidden=!open;
  if(open){hadLock=false;document.exitPointerLock?.();drawTactical(game,$('tacticalCanvas'),{labels:true});}
  else {canvas.focus({preventScroll:true});requestCapture();}
}
function selectAgent(index){
  if(!active||paused||finished)return;
  if(switchAgent(game,index)){clearInput();notify('HANDOFF / '+activeAgent(game).name);}
}
function execute(action,point){
  if(!active||finished)return;
  if(command(game,action,point)){sound.play('scope');renderHUD();}
}
function renderHUD(){
  if(!active)return;
  const a=activeAgent(game),o=objective(game),b=game.bonus;
  $('sectorTitle').textContent=game.mission.district;
  $('objective').textContent=o.label.toUpperCase();
  $('objectiveProgress').textContent=Math.round(o.fraction*100)+'%';
  $('agentTitle').textContent=a.name+' / '+a.role;
  $('agentStats').textContent='HP '+Math.max(0,Math.ceil(a.hp))+'/'+a.maxHp+
    ' · '+a.weapon.toUpperCase()+' '+Math.max(0,Math.ceil(a.ammo))+'/'+a.magazine+
    (a.reload>0?' · RELOADING':'');
  $('chronoValue').textContent=Math.floor(b.chrono)+'%';
  $('chronoFill').style.width=b.chrono+'%';
  $('chronoLabel').textContent=b.chronoActive?'CHRONO ENGAGED':'CHRONO RESERVE · HOLD B';
  $('enemyCount').textContent=game.guards.filter(x=>x.hp>0).length+' HOSTILES';
  $('timeCount').textContent=game.time.toFixed(1)+'s';
  $('mapButton').setAttribute('aria-pressed',String(game.tactical));
  const group=$('roster');group.replaceChildren();
  for(const u of game.agents){
    const button=document.createElement('button');
    button.type='button';button.className='agent'+(u.id===game.viewId?' current':'');
    button.disabled=u.hp<=0;
    button.textContent=(u.id+1)+' '+u.name+' · '+Math.max(0,Math.ceil(u.hp))+' HP';
    button.addEventListener('click',()=>selectAgent(u.id));group.append(button);
  }
  $('notification').textContent=game.log[0]?.text||'FOUR AGENTS · ONE CONSCIENCE.';
}
function finish(){
  if(finished)return;
  finished=true;paused=true;game.paused=true;hadLock=false;clearInput();sound.stopMusic();
  document.exitPointerLock?.();$('mapPanel').hidden=true;$('pausePanel').hidden=true;
  const won=game.phase==='won';
  if(won){progress=recordVictory(progress,sector,game.time);saveProgress();sound.play('collateral');}
  else sound.play('end');
  $('resultTitle').textContent=won?'HOSTILE TAKEOVER COMPLETE':'CONTRACT TERMINATED';
  $('resultText').textContent=won?game.mission.district+' secured in '+game.time.toFixed(1)+
    ' seconds. '+game.agents.filter(a=>a.hp>0).length+' surviving operators · '+game.kills+' hostiles neutralised.':
    game.log[0]?.text||'Squad eliminated.';
  $('next').hidden=!won||sector+1>=SECTORS.length;
  $('resultPanel').hidden=false;
}
function sampleStep(){
  if(!game.tactical){
    const ax=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft'));
    const ay=Number(held.has('ArrowDown'))-Number(held.has('ArrowUp'));
    if(ax||ay)look(game,ax*700*STEP,ay*600*STEP);
  }
  const view=game.viewId;
  stepBonus(game,{
    forward:Number(held.has('KeyW'))-Number(held.has('KeyS')),
    strafe:Number(held.has('KeyD'))-Number(held.has('KeyA')),
    sprint:held.has('ShiftLeft')||held.has('ShiftRight'),
    crouch:held.has('ControlLeft')||held.has('ControlRight'),
    jump:pendingJump,ads:Boolean(mouseButtons&2),
    fire:Boolean(mouseButtons&1)||held.has('Space')||pendingFire,
    chrono:held.has('KeyB')
  },STEP);
  pendingFire=false;pendingJump=false;
  if(view!==game.viewId)clearInput();
  if(game.phase!=='active')finish();
}
function frame(now){
  const delta=previous===null?0:Math.max(0,Math.min(.1,(now-previous)/1000));
  previous=now;
  if(active&&!paused&&!finished){
    debt=Math.min(.1,debt+delta);
    let ticks=0;
    while(debt>=STEP&&ticks++<6&&game.phase==='active'){sampleStep();debt-=STEP;}
    if(finished)debt=0;
  }
  if(renderer&&game){
    renderer.render(game,{alpha:Math.max(0,Math.min(1,debt/STEP)),
      time:now/1000,menu:!active,quality:'balanced',reduced:false});
  }
  if(active){
    for(const e of game.events.splice(0)){
      if(e.type==='shot')sound.play(e.manual?'shot':'enemyShot');
      else if(e.type==='hit')sound.play('hit');
    }
    sound.music(!paused&&!finished,game.alert>0?1:0);
    uiDebt+=delta;
    if(uiDebt>=.12){uiDebt=0;renderHUD();drawTactical(game,$('miniMap'));
      if(game.tactical)drawTactical(game,$('tacticalCanvas'),{labels:true});}
  }
  requestAnimationFrame(frame);
}
$('launch').addEventListener('click',()=>begin(sector));
$('difficulty').addEventListener('change',()=>{difficulty=$('difficulty').value;});
$('pauseButton').addEventListener('click',()=>setPause(!paused));
$('resume').addEventListener('click',()=>setPause(false));
$('retry').addEventListener('click',()=>begin(sector));
$('quit').addEventListener('click',enterHome);
$('retryEnd').addEventListener('click',()=>begin(sector));
$('next').addEventListener('click',()=>begin(sector+1));
$('homeEnd').addEventListener('click',enterHome);
$('mapButton').addEventListener('click',()=>toggleMap());
$('closeMap').addEventListener('click',()=>toggleMap(false));
$('selectAll').addEventListener('click',()=>{selectSquad(game,[0,1,2,3]);renderHUD();});
$('selectPilot').addEventListener('click',()=>{selectSquad(game,[game.viewId]);renderHUD();});
for(const button of document.querySelectorAll('[data-command]'))
  button.addEventListener('click',()=>execute(button.dataset.command));
$('tacticalCanvas').addEventListener('click',e=>{
  if(!active||paused||!game.tactical)return;
  const p=mapCoordinates(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect(),game.world.size);
  if(!p)return;
  const enemy=game.guards.find(u=>u.hp>0&&visibleGuard(game,u)&&Math.hypot(p.x-u.x,p.y-u.y)<.8);
  execute(enemy?'attack':'move',enemy||p);
});
$('tacticalCanvas').addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(!active||paused||game.tactical)return;
  if(document.pointerLockElement!==canvas){firstCapture=true;requestCapture();return;}
  const before=mouseButtons;mouseButtons=e.buttons;
  if((mouseButtons&1)&&!(before&1))pendingFire=true;
});
document.addEventListener('pointermove',e=>{
  if(document.pointerLockElement!==canvas||!active||paused||game.tactical)return;
  const before=mouseButtons;mouseButtons=e.buttons;
  if((mouseButtons&1)&&!(before&1))pendingFire=true;
  look(game,e.movementX,e.movementY);
});
document.addEventListener('pointerup',e=>{
  if(document.pointerLockElement!==canvas)return;
  mouseButtons=e.buttons;
});
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;
  if(locked){hadLock=true;firstCapture=false;mouseAvailable=true;}
  else if(hadLock&&active&&!paused&&!game.tactical){hadLock=false;setPause(true);}
});
document.addEventListener('keydown',e=>{
  if(!active||e.target.closest('select,input,textarea,button'))return;
  const k=e.code;
  if(['Space','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k))e.preventDefault();
  if((k==='Escape'||k==='KeyP')&&!e.repeat){setPause(!paused);return;}
  if(k==='Tab'||k==='KeyM'){if(!e.repeat)toggleMap();return;}
  if(finished)return;
  if(!e.repeat){
    if(/^Digit[1-4]$/.test(k)){selectAgent(Number(k.slice(-1))-1);return;}
    if(k==='KeyQ'){nextAgent(game);clearInput();return;}
    if(k==='KeyR'){if(reload(game))sound.play('reload');return;}
    const cmds={KeyF:'follow',KeyG:'move',KeyH:'hold',
      KeyV:'fire',KeyX:'emp',KeyC:'heal',KeyZ:'panic'};
    if(cmds[k]){execute(cmds[k]);return;}
    if(k==='KeyJ')pendingJump=true;
    if(k==='Space')pendingFire=true;
  }
  if(!paused)held.add(k);
});
document.addEventListener('keyup',e=>held.delete(e.code));
window.addEventListener('blur',()=>{if(active&&!paused)setPause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!paused)setPause(true);});
try{
  game=createBonusOperation(0);
  renderer=new Renderer(canvas,game.world);
  game.paused=true;renderSectors();requestAnimationFrame(frame);
}catch(e){$('fatal').hidden=false;$('fatalText').textContent=String(e);}
if(new URLSearchParams(location.search).has('qa')){
  Object.defineProperty(window,'compactQA',{value:{
    get game(){return game;},get active(){return active;},get paused(){return paused;},
    get renderer(){return renderer;},begin,pause:setPause,map:toggleMap,
    tick:(n=1)=>{for(let i=0;i<n;i++)sampleStep();},home:enterHome
  }});
}
