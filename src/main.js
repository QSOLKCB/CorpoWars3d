// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from './vendor/time.js';
import {createCampaign,decodeCampaign,MISSIONS,WEAPONS,RESEARCH,equip,research,canResearch,missionUnlocked,settleMission} from './campaign.js';
import {recordChallenges} from './challenges.js';
import {visibleGuard,lineOfSight} from './simulation.js';
import {createOperation,activeAgent,switchAgent,nextAgent,setTactical,selectSquad,command,objective,update,look,reload,SCALE,STEP,COLORS} from './fps.js';
import {Renderer} from './renderer.js';
import {Sound} from './audio.js';
import {Devices} from './devices.js';
const nodes=new Map(),$=id=>nodes.get(id)||(nodes.set(id,document.getElementById(id)),nodes.get(id)),canvas=$('viewport');
const SAVE='corpowars3d-campaign-v1',OPTIONS='corpowars3d-settings-v1';
const defaults={touchControls:'auto',controllerSensitivity:1,touchSensitivity:1,deadzone:.16,quality:matchMedia('(pointer: coarse)').matches?'balanced':'high',sensitivity:1,invert:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,keyboard:false,volume:.45,musicVolume:.15};
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function write(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
const campaign=decodeCampaign(read(SAVE))||createCampaign(),settings={...defaults};
try{
  const s=JSON.parse(read(OPTIONS));
  if(s&&typeof s==='object')for(const key of Object.keys(defaults)){
    if(typeof defaults[key]==='boolean'&&typeof s[key]==='boolean')settings[key]=s[key];
    else if(key==='quality'&&['high','balanced','low'].includes(s[key]))settings[key]=s[key];
    else if(key==='touchControls'&&['auto','on','off'].includes(s[key]))settings[key]=s[key];
    else if(['sensitivity','controllerSensitivity','touchSensitivity','deadzone','volume','musicVolume'].includes(key)&&Number.isFinite(s[key])){
      const sensitivity=key.toLowerCase().includes('sensitivity');settings[key]=Math.max(sensitivity?.5:key==='deadzone'?.05:0,Math.min(sensitivity?2.5:key==='deadzone'?.35:1,s[key]));
    }
  }
}catch{/* Optional settings never block the game. */}
let mission=campaign.mission,g=createOperation(campaign,mission),playing=false,renderer=null;
const sound=new Sound(),clock=new FixedClock({step:STEP,maxFrame:.1,maxSteps:6});
const held=new Set();let fire=false,ads=false,lastTime=null,uiTime=0,frames=0,fps=0,fpsTime=0,hadLock=false,keyboardFallback=false,settled=false,lastHp=120;
let background=null,mapWorld=null,lastMapPoint=null,devices=null,multipleSelection=false,mapAttack=false,pendingFire=false,pendingJump=false,captureClick=false;
const agentButtons=[],agentUI=[],worldLabels=[];
function saveCampaign(){const ok=write(SAVE,JSON.stringify(campaign));$('saveStatus').textContent=ok?'PROGRESS SAVED ON THIS BROWSER.':'SESSION ONLY / browser storage is unavailable.';}
function clearInput(){held.clear();fire=false;ads=false;pendingFire=false;pendingJump=false;devices?.clear();}
function syncPauseUI(){
  if(g.phase!=='active')return;
  const planning=g.paused&&g.tactical;
  $('pause').hidden=!g.paused||planning;
  $('pauseButton').textContent=g.paused?'▶':'Ⅱ';
  $('pauseButton').setAttribute('aria-label',g.paused?'Resume game':'Pause game');
  $('tacticalFeed').textContent=planning?'PAUSED / ORDERS QUEUED':'LIVE TACTICAL FEED';
  $('returnFPS').querySelector('kbd').textContent=planning?'M':'TAB';devices?.refresh();
}
function setPaused(value){
  if(!playing||g.phase!=='active')return;
  g.paused=value;clock.setPaused(value);clearInput();sound.stopMusic();syncPauseUI();
  if(value){$('pauseTitle').textContent='TAKE A BREATH.';$('pauseText').textContent='The district can wait. Your squad is paused.';$('resume').hidden=false;$('resume').firstChild.textContent='RESUME OPERATION ';document.exitPointerLock?.();}
  else if(!g.tactical)requestControl();
  renderHUD();
}
function requestControl(){
  if(!devices?.pointer||settings.keyboard||keyboardFallback||g.tactical||!playing||g.paused||document.pointerLockElement===canvas)return;
  captureClick=true;
  try{
    const p=canvas.requestPointerLock?.();
    if(p?.catch)p.catch(()=>{keyboardFallback=true;hadLock=false;});
    if(!canvas.requestPointerLock)keyboardFallback=true;
  }catch{keyboardFallback=true;}
}
function tactical(value=!g.tactical){
  if(!playing||g.phase!=='active')return;
  clearInput();setTactical(g,value);$('tactical').hidden=!value;document.body.classList.toggle('tactical-mode',value);
  syncPauseUI();
  if(value){lastMapPoint={x:activeAgent(g).x,y:activeAgent(g).y};devices.cursor={...lastMapPoint};}
  if(value)document.exitPointerLock?.();else if(!g.paused)requestControl();
  renderHUD();
}
function switchTo(id){
  if(!switchAgent(g,id))return;
  clearInput();if(g.tactical)tactical(false);lastHp=activeAgent(g).hp;sound.play('scope');renderHUD();
}
function startMission(){
  campaign.mission=mission;saveCampaign();g=createOperation(campaign,mission);
  for(const a of g.agents)a.yaw=1.35;
  renderer.setWorld(g.world);mapWorld=null;settled=false;playing=true;lastHp=activeAgent(g).hp;
  $('menu').hidden=true;$('hud').hidden=false;$('pause').hidden=true;$('tactical').hidden=true;
  document.body.classList.remove('tactical-mode');clock.reset();clock.setPaused(false);clearInput();hadLock=false;
  syncPauseUI();
  sound.start();sound.setVolume(settings.volume);sound.setMusicVolume(settings.musicVolume);sound.play('start');
  $('districtHud').textContent=g.mission.district.toUpperCase();renderHUD();requestControl();
}
function headquarters(){
  playing=false;g.paused=true;clock.setPaused(true);clearInput();sound.stopMusic();document.exitPointerLock?.();
  $('menu').hidden=false;$('hud').hidden=true;$('pause').hidden=true;document.body.classList.remove('tactical-mode');
  mission=campaign.mission;devices?.refresh();renderHQ();
}
function complete(){
  if(settled)return;settled=true;g.paused=true;clock.setPaused(true);clearInput();document.exitPointerLock?.();sound.stopMusic();
  let reward=0;
  if(g.phase==='won'){reward=settleMission(campaign,g.missionIndex,'won');recordChallenges(campaign,g);saveCampaign();sound.play('collateral');}
  else sound.play('end');
  $('pauseTitle').textContent=g.phase==='won'?'CONTRACT CLOSED.':'LINK TERMINATED.';
  $('pauseText').textContent=g.phase==='won'?`${g.agents.filter(a=>a.hp>0).length} agents extracted. ${g.kills} security units neutralised. ${reward?`${reward.toLocaleString()} credits transferred.`:'Contract already paid.'}`:g.log[0]?.text||'All agents have been lost.';
  $('resume').hidden=false;$('resume').firstChild.textContent='RETURN TO HEADQUARTERS ';$('pause').hidden=false;devices?.refresh();
}
function renderHQ(){
  $('credits').textContent=campaign.cash.toLocaleString()+' CR';$('armoryCredits').textContent=campaign.cash.toLocaleString()+' CR';
  $('difficulty').value=campaign.difficulty;$('missionList').replaceChildren();
  MISSIONS.forEach((m,i)=>{
    const b=document.createElement('button');b.className='mission-button'+(i===mission?' selected':'');b.disabled=!missionUnlocked(campaign,i);
    const number=document.createElement('span');number.className='number';number.textContent=String(i+1).padStart(2,'0');b.append(number,document.createTextNode(m.name));
    if(campaign.completed.includes(i)){const c=document.createElement('span');c.className='complete';c.textContent='✓';b.append(c);}
    b.addEventListener('click',()=>{mission=i;renderHQ();});$('missionList').append(b);
  });
  const m=MISSIONS[mission];$('districtName').textContent='DISTRICT / '+m.district.toUpperCase();$('missionName').textContent=m.name;$('missionBrief').textContent=m.brief;$('missionReward').textContent='CONTRACT VALUE / '+m.reward.toLocaleString()+' CR';
  $('loadouts').replaceChildren();
  for(const a of g.agents){
    const row=document.createElement('div');row.className='loadout';const name=document.createElement('div');name.textContent=`0${a.id+1} / ${a.name}`;
    const role=document.createElement('small');role.textContent=a.role;name.append(role);
    const select=document.createElement('select');select.setAttribute('aria-label',a.name+' weapon');
    for(const [id,w] of Object.entries(WEAPONS)){
      const option=document.createElement('option');option.value=id;const owned=campaign.owned[a.id].includes(id);
      option.textContent=w.name+(owned?' / OWNED':` / ${w.cost} CR`);option.disabled=!owned&&campaign.cash<w.cost;select.append(option);
    }
    select.value=campaign.loadout[a.id];select.addEventListener('change',()=>{equip(campaign,a.id,select.value);saveCampaign();renderHQ();});row.append(name,select);$('loadouts').append(row);
  }
  $('research').replaceChildren();
  for(const r of RESEARCH){
    const done=campaign.research.includes(r.id),b=document.createElement('button');b.className='research-card'+(done?' done':'');b.disabled=done||!canResearch(campaign,r.id);
    const label=document.createElement('span');label.textContent=r.branch;const name=document.createElement('b');name.textContent=r.name;
    const desc=document.createElement('small');desc.textContent=r.description;const cost=document.createElement('b');cost.textContent=done?'INSTALLED':r.cost.toLocaleString()+' CR';b.append(label,name,desc,cost);
    b.addEventListener('click',()=>{research(campaign,r.id);saveCampaign();renderHQ();});$('research').append(b);
  }
}
function execute(kind){
  if(!playing)return;
  const point=g.tactical?(lastMapPoint||objective(g).point):undefined;
  const ok=command(g,kind,point);if(ok)sound.play(kind==='heal'?'loaded':kind==='emp'?'collateral':'scope');renderHUD();
}
function makeSquad(){
  for(const a of g.agents){
    const b=document.createElement('button');b.className='agent';b.style.setProperty('--agent',`rgb(${COLORS[a.id].map(c=>Math.round(c*255)).join(' ')})`);
    b.innerHTML='<span class="agent-top"><span class="number"></span><span class="name"></span></span><span class="role"></span><div class="hp-bar"><i></i></div><span class="agent-bottom"><span></span><span></span></span>';
    b.querySelector('.number').textContent=String(a.id+1).padStart(2,'0');b.querySelector('.name').textContent=a.name;b.querySelector('.role').textContent=a.role;
    b.title=`Switch to ${a.name}. In tactical view, click to select; Shift-click adds or removes.`;
    b.addEventListener('click',e=>{
      if(g.agents[a.id].hp<=0)return;
      if(g.tactical){const ids=e.shiftKey||multipleSelection?new Set(g.selected):new Set();if(ids.has(a.id))ids.delete(a.id);else ids.add(a.id);selectSquad(g,[...ids]);renderHUD();}
      else switchTo(a.id);
    });b.addEventListener('dblclick',()=>{if(g.tactical)switchTo(a.id);});$('squad').append(b);agentButtons.push(b);agentUI.push({hp:b.querySelector('.hp-bar i'),line:b.querySelector('.agent-bottom')});
  }
  for(let i=0;i<5;i++){const label=document.createElement('div');label.className='world-label'+(i===4?' objective-label':'');$('worldLabels').append(label);worldLabels.push(label);}
}
function renderHUD(){
  if(!playing)return;
  const a=activeAgent(g),o=objective(g),living=g.agents.filter(u=>u.hp>0).length;
  $('objectiveNumber').textContent='CONTRACT OBJECTIVE / '+(!g.relay.done?'01':!g.vault.done?'02':'03');$('objectiveText').textContent=o.label;$('objectiveProgress').style.width=(o.fraction*100)+'%';
  $('squadCount').textContent=String(living).padStart(2,'0')+' ONLINE';$('selectionInfo').textContent=g.selected.size===living?'ALL SELECTED':g.selected.size+' SELECTED';
  for(const u of g.agents){
    const b=agentButtons[u.id];b.disabled=u.hp<=0;b.classList.toggle('active',u.id===g.viewId);b.classList.toggle('selected',g.selected.has(u.id));b.classList.toggle('dead',u.hp<=0);
    agentUI[u.id].hp.style.width=Math.max(0,u.hp/u.maxHp*100)+'%';
    const line=agentUI[u.id].line;line.children[0].textContent=Math.ceil(u.hp)+' HP';line.children[1].textContent=u.hp<=0?'OFFLINE':g.controlled===u.id?'DIRECT LINK':'AI / '+u.command;
    b.setAttribute('aria-label',`${u.name}, ${Math.ceil(u.hp)} HP, ${u.id===g.controlled?'directly controlled':u.command}`);b.setAttribute('aria-pressed',String(g.tactical?g.selected.has(u.id):g.viewId===u.id));
  }
  $('weaponName').textContent=WEAPONS[a.weapon].name.toUpperCase();$('ammo').textContent=String(a.ammo).padStart(2,'0');$('magazine').textContent='/ '+a.magazine;
  $('weaponState').textContent=a.reload>0?'RELOADING '+a.reload.toFixed(1)+'s':a.stance==='crouch'?'CROUCHED / '+a.name:'DIRECT LINK / '+a.name;
  $('status').textContent=g.paused?(g.tactical?'TACTICAL UPLINK / PAUSED':'UPLINK PAUSED'):g.lockdownRemaining!==null?'LOCKDOWN / '+Math.ceil(g.lockdownRemaining)+'s':g.tactical?'TACTICAL UPLINK / LIVE':settings.keyboard||keyboardFallback?'KEYBOARD AIM ACTIVE':g.alert>0?'SECURITY ALERT':'UPLINK STABLE';
  $('stats').textContent=`${fps} FPS / ${renderer.software?'SOFTWARE':renderer.instanced?'INSTANCED':'WEBGL COMPATIBILITY'} / ${Math.floor(g.time/60)}:${String(Math.floor(g.time%60)).padStart(2,'0')}`;
  for(const b of document.querySelectorAll('[data-command]')){
    const kind=b.dataset.command;
    b.disabled=(kind==='escort'&&!g.courier?.active)||(kind==='mode'&&![...g.selected].some(id=>g.agents[id]?.weapon==='aug'))||(g.paused&&['heal','emp','panic'].includes(kind))||(kind==='panic'&&g.panicCooldown>0);
    if(kind==='fire')b.lastChild.textContent=g.holdFire?' HOLD FIRE':' WEAPONS FREE';
    if(kind==='emp')b.lastChild.textContent=' EMP / '+g.pulses;
    if(kind==='heal')b.lastChild.textContent=' PATCH / '+g.medkits;
    if(kind==='panic')b.lastChild.textContent=g.panicActive>0?' PANIC / ACTIVE '+Math.ceil(g.panicActive)+'s':g.panicCooldown>0?' PANIC / '+Math.ceil(g.panicCooldown)+'s':' PANIC / READY';
  }
  const signature=g.log.map(e=>e.time+e.text).join('|');
  if($('log').dataset.signature!==signature){$('log').dataset.signature=signature;$('log').replaceChildren();for(const l of g.log.slice(0,3)){const p=document.createElement('p');p.textContent=l.text;$('log').append(p);}}
  const d=Math.hypot(a.x-o.point.x,a.y-o.point.y)*SCALE;
  $('aimInfo').textContent=g.ads?`${a.name} / ADS / ${Math.round(d)}m TO OBJECTIVE`:d<4.25?'STAND STILL TO OPERATE TERMINAL / AUTOMATIC':'';
}
function labels(){
  if(!playing||g.tactical)return;
  const a=activeAgent(g),goal=objective(g);
  for(let i=0;i<5;i++){
    const u=i===4?goal.point:g.agents[i],label=worldLabels[i];
    const visible=i===4||i!==g.viewId&&u.hp>0&&lineOfSight(g.world,a,u);
    const point=visible?renderer.project([u.x*SCALE,i===4?3.1:2.2+(u.elevation||0),u.y*SCALE]):null;
    label.hidden=!point;if(!point)continue;label.style.left=point[0]+'px';label.style.top=point[1]+'px';
    const text=i===4?(goal.key==='exit'?'EXTRACTION':g.mission.labels[goal.key==='relay'?0:1]):u.name;
    if(label.textContent!==text)label.textContent=text;
  }
  $('hitMarker').hidden=g.hit<=0;
  if(a.hp<lastHp)$('damage').style.boxShadow='inset 0 0 130px #d3483466';else $('damage').style.boxShadow='inset 0 0 130px #c2393000';lastHp=a.hp;
  $('reticle').style.opacity=g.ads?'.65':'1';
}
function mapBase(){
  if(mapWorld===g.world)return;mapWorld=g.world;background=document.createElement('canvas');background.width=760;background.height=760;
  const c=background.getContext('2d'),n=g.world.size,s=700/n,pad=30;
  c.fillStyle='#101d23';c.fillRect(0,0,760,760);c.strokeStyle='#293b41';c.lineWidth=1;
  for(let i=0;i<=n;i++){const x=pad+i*s;c.beginPath();c.moveTo(x,pad);c.lineTo(x,730);c.moveTo(pad,x);c.lineTo(730,x);c.stroke();}
  for(const b of g.world.buildings){c.fillStyle='#30474f';c.fillRect(pad+b.x*s,pad+b.y*s,b.w*s,b.d*s);c.strokeStyle='#56717a';c.strokeRect(pad+b.x*s,pad+b.y*s,b.w*s,b.d*s);}
  c.font='11px monospace';c.fillStyle='#82999e';c.fillText('N ↑',30,21);c.fillText(g.mission.district.toUpperCase(),540,752);
}
function drawMap(canvas,large=false){
  mapBase();const c=canvas.getContext('2d'),scale=canvas.width/760,s=700/g.world.size,pad=30;
  c.setTransform(scale,0,0,scale,0,0);c.drawImage(background,0,0);
  for(const a of g.agents)if(a.hp>0&&a.path.length){
    c.strokeStyle=g.selected.has(a.id)?'#75d6c780':'#75d6c730';c.lineWidth=2;c.beginPath();c.moveTo(pad+a.x*s,pad+a.y*s);
    for(const p of a.path)c.lineTo(pad+p.x*s,pad+p.y*s);c.stroke();
  }
  if(large&&lastMapPoint){
    const x=pad+lastMapPoint.x*s,y=pad+lastMapPoint.y*s;
    c.strokeStyle=mapAttack?'#f17e68':'#ecb66d';c.lineWidth=2;c.beginPath();c.arc(x,y,13,0,Math.PI*2);c.moveTo(x-19,y);c.lineTo(x+19,y);c.moveTo(x,y-19);c.lineTo(x,y+19);c.stroke();
  }
  const current=objective(g);
  for(const key of ['relay','vault','exit']){
    const p=g[key],x=pad+p.x*s,y=pad+p.y*s,highlight=key===current.key;
    c.fillStyle=p.done?'#75d6c7':highlight?'#ecb66d':'#7d8e93';c.beginPath();c.moveTo(x,y-8);c.lineTo(x+8,y);c.lineTo(x,y+8);c.lineTo(x-8,y);c.closePath();c.fill();
    if(highlight){c.strokeStyle='#ecb66d66';c.beginPath();c.arc(x,y,18,0,Math.PI*2);c.stroke();}
    if(large){c.font='11px monospace';c.fillText(key.toUpperCase(),x+13,y+4);}
  }
  for(const e of g.guards)if(visibleGuard(g,e)){
    c.fillStyle=e.stun>0?'#91b7e5':'#f17e68';c.fillRect(pad+e.x*s-5,pad+e.y*s-5,10,10);
  }
  if(g.courier?.active&&g.courier.hp>0){c.fillStyle='#dfceff';c.beginPath();c.arc(pad+g.courier.x*s,pad+g.courier.y*s,7,0,Math.PI*2);c.fill();}
  for(const a of g.agents){
    if(a.hp<=0)continue;const x=pad+a.x*s,y=pad+a.y*s,angle=a.yaw-Math.PI/2;
    const col='rgb('+COLORS[a.id].map(n=>Math.round(n*255)).join(' ')+')';
    if(a.id===g.viewId){c.fillStyle='#ecb66d22';c.beginPath();c.moveTo(x,y);c.arc(x,y,55,angle-.6,angle+.6);c.closePath();c.fill();}
    c.fillStyle=col;c.beginPath();c.arc(x,y,a.id===g.viewId?9:7,0,Math.PI*2);c.fill();
    if(g.selected.has(a.id)){c.strokeStyle='#e0e8e5';c.lineWidth=2;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.stroke();}
    c.strokeStyle=col;c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(angle)*20,y+Math.sin(angle)*20);c.stroke();
    if(large){c.fillStyle=col;c.font='bold 12px monospace';c.fillText((a.id+1)+' '+a.name,x+14,y-12);}
  }
}
function mapPoint(event){const r=$('tacticalMap').getBoundingClientRect();return {x:Math.max(0,Math.min(35.99,((event.clientX-r.left)/r.width*760-30)/700*36)),y:Math.max(0,Math.min(35.99,((event.clientY-r.top)/r.height*760-30)/700*36))};}
for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{
  for(const t of document.querySelectorAll('[data-tab]'))t.classList.toggle('selected',t===b);
  for(const id of ['contracts','armory','settings'])$(id).hidden=id!==b.dataset.tab;
});
for(const key of Object.keys(defaults)){
  const el=$(key);if(!el)continue;if(typeof defaults[key]==='boolean')el.checked=settings[key];else el.value=settings[key];
  el.addEventListener('input',()=>{
    settings[key]=typeof defaults[key]==='boolean'?el.checked:['quality','touchControls'].includes(key)?el.value:Number(el.value);
    if(key==='touchControls'){clearInput();devices.refresh();}
    write(OPTIONS,JSON.stringify(settings));sound.setVolume(settings.volume);sound.setMusicVolume(settings.musicVolume);
  });
}
$('difficulty').addEventListener('change',()=>{campaign.difficulty=$('difficulty').value;saveCampaign();});
$('deploy').addEventListener('click',startMission);$('resume').addEventListener('click',()=>g.phase==='active'?setPaused(false):headquarters());
$('restart').addEventListener('click',startMission);$('headquarters').addEventListener('click',headquarters);$('pauseButton').addEventListener('click',()=>setPaused(!g.paused));
$('miniMapButton').addEventListener('click',()=>tactical());$('returnFPS').addEventListener('click',()=>tactical(false));
$('selectAll').addEventListener('click',()=>{selectSquad(g,g.agents.map(a=>a.id));renderHUD();});
$('selectCurrent').addEventListener('click',()=>{selectSquad(g,[g.viewId]);renderHUD();});
for(const b of document.querySelectorAll('[data-command]'))b.addEventListener('click',()=>execute(b.dataset.command));
$('tacticalMap').addEventListener('mousemove',e=>{lastMapPoint=mapPoint(e);});
function attackAt(p){
  let target=null,best=.9*.9;
  for(const enemy of g.guards){const d=(enemy.x-p.x)**2+(enemy.y-p.y)**2;if(d<best&&visibleGuard(g,enemy)){target=enemy;best=d;}}
  if(target&&command(g,'attack',target)){sound.play('scope');renderHUD();}
}
$('tacticalMap').addEventListener('click',e=>{lastMapPoint=mapPoint(e);if(mapAttack)attackAt(lastMapPoint);else execute('move');});
$('tacticalMap').addEventListener('contextmenu',e=>{e.preventDefault();attackAt(mapPoint(e));});
$('selectMultiple').addEventListener('click',()=>{multipleSelection=!multipleSelection;$('selectMultiple').setAttribute('aria-pressed',String(multipleSelection));});
$('pilotSelected').addEventListener('click',()=>{const id=[...g.selected].find(id=>g.agents[id].hp>0);if(id!==undefined)switchTo(id);});
$('mapAttack').addEventListener('click',()=>{mapAttack=!mapAttack;$('mapAttack').setAttribute('aria-pressed',String(mapAttack));});
document.addEventListener('keydown',e=>{
  if(!playing||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  const code=e.code;
  if(code==='Escape'){if(!e.repeat&&g.phase==='active')setPaused(!g.paused);return;}
  if(code==='KeyP'&&!e.repeat){setPaused(!g.paused);return;}
  const commands={KeyF:'follow',KeyG:'move',KeyH:'hold',KeyV:'fire',KeyX:'emp',KeyC:'heal',KeyZ:'panic',KeyE:'escort',KeyB:'mode'};
  if(g.paused){
    if(!g.tactical)return;
    // Planning controls stay live; movement, aiming and trigger input never enter
    // the held-input set. Tab retains ordinary keyboard focus navigation here.
    if(commands[code]){e.preventDefault();if(!e.repeat)execute(commands[code]);}
    else if(code==='KeyM'){e.preventDefault();if(!e.repeat)tactical(false);}
    else if(/^Digit[1-4]$/.test(code)){if(!e.repeat)switchTo(Number(code.slice(-1))-1);}
    else if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))e.preventDefault();
    return;
  }
  if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))e.preventDefault();
  if(e.repeat&&!held.has(code))return;
  held.add(code);if(e.repeat)return;
  if(code==='Space')pendingFire=true;if(code==='KeyJ')pendingJump=true;
  if(/^Digit[1-4]$/.test(code)){switchTo(Number(code.slice(-1))-1);return;}
  if(code==='KeyQ'){nextAgent(g);clearInput();lastHp=activeAgent(g).hp;renderHUD();return;}
  if(code==='Tab'||code==='KeyM'){tactical();return;}
  if(commands[code])execute(commands[code]);if(code==='KeyR'&&reload(g))sound.play('reload');
});
document.addEventListener('keyup',e=>held.delete(e.code));
function buttons(e){if(playing&&!g.paused&&!g.tactical){if(!(e.buttons&1))captureClick=false;const down=Boolean(e.buttons&1)&&!captureClick;if(down&&!fire)pendingFire=true;fire=down;ads=Boolean(e.buttons&2);}}
canvas.addEventListener('mousedown',e=>{if(!playing||g.paused||g.tactical)return;e.preventDefault();if(devices.pointer&&!settings.keyboard&&!keyboardFallback&&document.pointerLockElement!==canvas){requestControl();return;}buttons(e);});
document.addEventListener('mouseup',buttons);canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===canvas&&playing&&!g.paused&&!g.tactical){buttons(e);look(g,e.movementX,e.movementY,.0022*settings.sensitivity,settings.invert);}
});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas){hadLock=true;keyboardFallback=false;}
  else {const wasLocked=hadLock;hadLock=false;if(wasLocked&&playing&&!g.tactical&&!g.paused)setPaused(true);}
});
document.addEventListener('pointerlockerror',()=>{keyboardFallback=true;hadLock=false;});
window.addEventListener('blur',()=>{if(playing)setPaused(true);clearInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playing)setPaused(true);clearInput();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(playing)setPaused(true);$('fatalText').textContent='The graphics context was lost. Reload to restore the renderer. Campaign progress is saved between contracts.';$('fatal').hidden=false;});
function simulation(dt){
  const device=devices.tick(dt);
  if(!g.tactical){
    const ax=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft')),ay=Number(held.has('ArrowDown'))-Number(held.has('ArrowUp'));
    if(ax||ay)look(g,ax*700*dt,ay*600*dt,.0022*settings.sensitivity,settings.invert);
  }
  const viewed=g.viewId;
  update(g,{forward:Number(held.has('KeyW'))-Number(held.has('KeyS'))+device.forward,strafe:Number(held.has('KeyD'))-Number(held.has('KeyA'))+device.strafe,
    sprint:held.has('ShiftLeft')||held.has('ShiftRight')||device.sprint,crouch:held.has('ControlLeft')||held.has('ControlRight')||device.crouch,
    jump:pendingJump||device.jump,ads:ads||device.ads,fire:fire||held.has('Space')||pendingFire||device.fire},dt);
  pendingJump=false;pendingFire=false;
  if(g.viewId!==viewed){clearInput();lastHp=activeAgent(g).hp;}
  if(g.phase!=='active')complete();
}
function frame(now){
  const delta=lastTime===null?0:Math.max(0,(now-lastTime)/1000);lastTime=now;
  devices.poll(Math.min(delta,.1));
  let alpha=1;
  if(playing&&!g.paused){alpha=clock.advance(delta,simulation).alpha;}
  // Tactical mode displays the same city beneath its command interface.
  renderer.render(g,{alpha,menu:!playing,time:now/1000,quality:settings.quality,reduced:settings.reduced});
  if(playing){
    for(const e of g.events.splice(0)){
      if(e.type==='shot')sound.play(e.manual?'shot':'enemyShot');else if(e.type==='hit')sound.play('hit');
    }
    sound.music(!g.paused&&g.phase==='active',g.alert>0?1:0);labels();
    uiTime+=delta;fpsTime+=delta;frames++;
    if(fpsTime>=1){fps=Math.round(frames/fpsTime);frames=0;fpsTime=0;}
    if(uiTime>=.1){uiTime=0;renderHUD();if(!devices.touchEnabled&&!g.tactical)drawMap($('miniMap'));if(g.tactical)drawMap($('tacticalMap'),true);}
  }
  requestAnimationFrame(frame);
}
try{
  renderer=new Renderer(canvas,g.world);makeSquad();renderHQ();
  const area=$('tacticalMap').parentElement,legend=area.querySelector('.map-legend');
  new ResizeObserver(()=>{
    const reserved=legend.getClientRects().length?legend.offsetWidth+(parseFloat(getComputedStyle(area).columnGap)||0):0;
    const size=Math.max(1,Math.min(area.clientWidth-reserved,area.clientHeight));
    $('tacticalMap').style.width=size+'px';$('tacticalMap').style.height=size+'px';
  }).observe(area);
  devices=new Devices({settings,state:()=>({playing,game:g}),actions:{
    source:()=>{held.clear();fire=false;ads=false;pendingFire=false;pendingJump=false;if(document.pointerLockElement===canvas){hadLock=false;document.exitPointerLock?.();}},
    pause:setPaused,map:tactical,cycle:()=>{nextAgent(g);clearInput();renderHUD();},reload:()=>{if(reload(g))sound.play('reload');},
    command:execute,look:(dx,dy,sensitivity)=>look(g,dx,dy,sensitivity,settings.invert),
    cursor:p=>{lastMapPoint={...p};},move:p=>{lastMapPoint={...p};execute('move');},attack:attackAt,
    recipient:()=>{const living=g.agents.filter(a=>a.hp>0).map(a=>a.id),current=[...g.selected][0],id=living[(living.indexOf(current)+1)%living.length];selectSquad(g,[id]);renderHUD();},
    selectAll:()=>{selectSquad(g,g.agents.map(a=>a.id));renderHUD();}
  }});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  // QA access is opt-in and absent in ordinary play. It never modifies mechanics.
  if(new URLSearchParams(location.search).has('qa'))Object.defineProperty(window,'corpowarsQA',{value:{get game(){return g;},get renderer(){return renderer;},get clock(){return clock;},get devices(){return devices;},start:startMission,tactical,command:(kind,p)=>command(g,kind,p),switchTo,pause:setPaused}});
  requestAnimationFrame(frame);
}catch(error){$('fatalText').textContent=error.message;$('fatal').hidden=false;console.error(error);}
