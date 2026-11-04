// SPDX-License-Identifier: Apache-2.0
// Browser adapters only. Simulation consumes the same actions on every device.
import {XboxInput,neutralPad} from './controller.js';
import {TouchInput} from './touch.js';
export class Devices {
  constructor({settings,state,actions}){
    this.settings=settings;this.state=state;this.actions=actions;
    this.controller=new XboxInput();this.touch=new TouchInput();this.pad=neutralPad();
    this.coarse=matchMedia('(pointer: coarse)');this.source=this.touchEnabled?'touch':'mouse';
    this.cursor={x:18,y:18};this.connected=false;this.jump=false;this.fireEdge=false;
    this.overlay=document.getElementById('touchOverlay');
    this.knob=document.querySelector('#movePad i');
    this.status=document.getElementById('deviceStatus');this.hint=document.getElementById('deviceHint');
    this.connectTouch();
    this.coarse.addEventListener('change',()=>{this.clear();this.refresh();});
    window.addEventListener('resize',()=>this.clear());
    document.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch')this.use('touch');
      else if(e.pointerType==='mouse'&&!e.sourceCapabilities?.firesTouchEvents)this.use('mouse');
    },true);
    document.addEventListener('keydown',()=>this.use('mouse'),true);
    this.refresh();
  }
  get touchEnabled(){return this.settings.touchControls==='on'||this.settings.touchControls==='auto'&&this.coarse.matches;}
  get pointer(){return this.source==='mouse'&&!this.touchEnabled;}
  use(source){
    if(this.source===source)return false;
    this.source=source;this.clear();this.actions.source();this.refresh();return true;
  }
  clear(){
    this.controller.reset();this.pad=neutralPad();this.touch.clear();this.jump=false;this.fireEdge=false;
    this.knob.style.transform='translate(0px,0px)';
    for(const el of this.overlay.querySelectorAll('.pressed'))el.classList.remove('pressed');
  }
  refresh(){
    const {playing,game:g}=this.state(),touch=this.touchEnabled;
    const signature=[playing,g.paused,g.tactical,g.phase,touch,this.source,this.connected,this.pad.ready].join('|');
    if(signature===this.uiSignature)return;this.uiSignature=signature;
    document.body.classList.toggle('touch-mode',touch);
    document.body.classList.toggle('controller-mode',this.source==='gamepad');
    this.overlay.hidden=!touch||!playing||g.paused||g.tactical||g.phase!=='active';
    const label=this.source==='gamepad'?(this.connected?(this.pad.ready?'XBOX / CONNECTED':'XBOX / RELEASE CONTROLS'):'CONTROLLER DISCONNECTED'):
      touch?'TOUCH / DRAG TO AIM':'MOUSE + KEYBOARD';
    if(this.status.textContent!==label)this.status.textContent=label;
    this.hint.hidden=!playing||this.source!=='gamepad'||this.connected&&this.pad.ready;
    if(this.hint.textContent!==label)this.hint.textContent=label;
  }
  connectTouch(){
    for(const el of this.overlay.querySelectorAll('[data-touch]')){
      const kind=el.dataset.touch;
      el.addEventListener('pointerdown',e=>{
        const {playing,game:g}=this.state();
        if(!playing||g.paused||g.tactical||!this.touchEnabled)return;
        e.preventDefault();
        if(!this.touch.begin(e.pointerId,kind,e.clientX,e.clientY))return;
        el.setPointerCapture(e.pointerId);el.classList.add('pressed');
        if(kind==='fire')this.fireEdge=true;
      });
      el.addEventListener('pointermove',e=>{
        this.touch.move(e.pointerId,e.clientX,e.clientY);
        if(kind==='move')this.knob.style.transform=`translate(${this.touch.moveX*34}px,${-this.touch.moveZ*34}px)`;
      });
      const release=e=>{
        const cancelled=e.type!=='pointerup'&&this.touch.pointers.has(e.pointerId);
        if(cancelled&&kind==='fire')this.fireEdge=false;
        this.touch.end(e.pointerId,cancelled);el.classList.toggle('pressed',this.touch.held(kind));
        if(kind==='move')this.knob.style.transform='translate(0px,0px)';
      };
      el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
      el.addEventListener('contextmenu',e=>e.preventDefault());
    }
    for(const el of this.overlay.querySelectorAll('[data-action]'))el.addEventListener('click',()=>{
      const {game:g}=this.state();if(g.paused||g.tactical)return;
      const action=el.dataset.action;if(action==='jump')this.jump=true;else this.actions[action]();
    });
  }
  navigate(p,root){
    const items=[...root.querySelectorAll('button:not(:disabled),select,input,summary')].filter(el=>el.getClientRects().length);
    if(!items.length)return;
    let focused=document.activeElement,index=items.indexOf(focused);
    if(p.up||p.down||index<0){
      index=index<0?0:(index+(p.up?-1:1)+items.length)%items.length;
      focused=items[index];focused.focus({preventScroll:true});focused.scrollIntoView({block:'nearest'});
    }
    if(p.left||p.right){
      const sign=p.left?-1:1;
      if(focused.tagName==='SELECT'){
        const options=[...focused.options];let n=focused.selectedIndex;
        do{n+=sign;}while(n>=0&&n<options.length&&options[n].disabled);
        if(n>=0&&n<options.length){focused.selectedIndex=n;focused.dispatchEvent(new Event('input',{bubbles:true}));focused.dispatchEvent(new Event('change',{bubbles:true}));}
      }else if(focused.type==='range'){
        if(sign>0)focused.stepUp();else focused.stepDown();focused.dispatchEvent(new Event('input',{bubbles:true}));
      }
    }
    if(p.accept||p.activate)focused.click();
  }
  poll(dt){
    if(document.hidden||!document.hasFocus()){this.controller.reset();this.pad=neutralPad();return;}
    let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{/* Browser may deny Gamepad API. */}
    const p=this.controller.sample(pads,this.settings.deadzone),wasConnected=this.connected;
    this.pad=p;this.connected=p.connected;
    if(this.source==='gamepad'&&((wasConnected&&!p.connected)||p.replaced)){
      this.actions.pause(true);this.refresh();return;
    }
    if(p.active&&this.use('gamepad'))return; // Neutral gate applies to device handoff too.
    this.refresh();if(this.source!=='gamepad'||!p.ready)return;
    const {playing,game:g}=this.state();
    if(!playing||g.phase!=='active'||g.paused&&!g.tactical){
      if(playing&&g.phase==='active'&&(p.pause||p.back)){this.actions.pause(false);return;}
      if(p.up||p.down||p.left||p.right||p.accept||p.activate)this.navigate(p,document.getElementById(playing?'pause':'menu'));
      return;
    }
    if(p.pause){this.actions.pause(!g.paused);return;}
    if(p.map||g.tactical&&p.back){this.actions.map();return;}
    if(g.tactical){
      if(p.moveX||p.moveZ){
        this.cursor.x=Math.max(.5,Math.min(g.world.size-.5,this.cursor.x+p.moveX*18*dt));
        this.cursor.y=Math.max(.5,Math.min(g.world.size-.5,this.cursor.y-p.moveZ*18*dt));
        this.actions.cursor(this.cursor);
      }
      if(p.accept)this.actions.move(this.cursor);
      if(p.reload)this.actions.attack(this.cursor);
      if(p.cycle)this.actions.recipient();
      if(p.follow)this.actions.selectAll();
      if(p.up||p.down||p.left||p.right||p.activate)this.navigate({...p,accept:false},document.getElementById('hud'));
      return;
    }
    if(p.cycle){this.actions.cycle();return;}
    if(p.jump)this.jump=true;
    if(p.fire)this.fireEdge=true;
    if(p.reload)this.actions.reload();
    if(p.follow)this.actions.command('follow');
    if(p.up)this.actions.command('move');if(p.down)this.actions.command('hold');
    if(p.left)this.actions.command('heal');if(p.right)this.actions.command('emp');
  }
  tick(dt){
    const p=this.source==='gamepad'?this.pad:neutralPad(),t=this.touch;
    if(p.lookX||p.lookY)this.actions.look(p.lookX*900*dt,p.lookY*700*dt,.0022*this.settings.controllerSensitivity);
    const [dx,dy]=t.consumeLook();if(dx||dy)this.actions.look(dx,dy,.004*this.settings.touchSensitivity);
    const out={forward:p.moveZ+t.moveZ,strafe:p.moveX+t.moveX,ads:p.aim||t.held('ads'),
      fire:p.fire||t.held('fire')||this.fireEdge,sprint:p.sprint||t.held('sprint'),crouch:p.crouch||t.held('crouch'),jump:this.jump};
    this.jump=false;this.fireEdge=false;return out;
  }
}
