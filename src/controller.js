// SPDX-License-Identifier: Apache-2.0
// Adapted from QUICKSCOPER 7c406e2545d82ee6bdc5fda5f198eb22fa183a84.
// VANILLAJS neutral-on-resume contract; browser-independent standard mapping.
import {clamp} from './math.js';
export function stick(x=0,y=0,deadzone=.16,curve=1){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(deadzone)||deadzone<0||deadzone>=1)return [0,0];
  const length=Math.hypot(x,y);if(length<=deadzone)return [0,0];
  const magnitude=clamp((length-deadzone)/(1-deadzone),0,1)**curve;
  return [x/length*magnitude,y/length*magnitude];
}
export const neutralPad=()=>({connected:false,ready:false,active:false,replaced:false,moveX:0,moveZ:0,lookX:0,lookY:0,fire:false,aim:false,sprint:false,crouch:false});
export class XboxInput {
  constructor(){this.identity='';this.index=-1;this.previous=new Array(17).fill(false);this.reset();}
  reset(){this.blocked=true;this.previous.fill(false);}
  sample(pads=[],deadzone=.16){
    const valid=p=>p&&p.connected!==false&&p.mapping==='standard';
    const all=Array.from(pads||[]),pad=all.find(p=>valid(p)&&p.index===this.index)||all.find(valid),out=neutralPad();
    if(!pad){this.identity='';this.index=-1;this.reset();return out;}
    const identity=`${pad.index}:${pad.id}`;
    out.replaced=!!this.identity&&identity!==this.identity;
    if(identity!==this.identity){this.reset();this.identity=identity;this.index=pad.index;}
    out.connected=true;
    const values=this.previous.map((_,i)=>{
      const b=pad.buttons?.[i];return Number.isFinite(b?.value)?clamp(b.value,0,1):Number(!!b?.pressed);
    });
    const held=values.map((value,i)=>value>(i===6||i===7?(this.previous[i] ? .1 : .25):.5));
    const move=stick(pad.axes?.[0],pad.axes?.[1],deadzone),look=stick(pad.axes?.[2],pad.axes?.[3],deadzone,1.6);
    // Use the lower trigger threshold while blocked: even a partial held pull
    // cannot arm a trigger merely by crossing its normal firing threshold.
    if(this.blocked){if(!values.some(v=>v>.1)&&!move.some(Boolean)&&!look.some(Boolean))this.blocked=false;return out;}
    const edge=i=>held[i]&&!this.previous[i];
    Object.assign(out,{ready:true,active:held.some(Boolean)||move.some(Boolean)||look.some(Boolean),
      moveX:move[0],moveZ:-move[1],lookX:look[0],lookY:look[1],aim:held[6],fire:held[7],
      sprint:held[10],crouch:held[1]||held[11],jump:edge(0),reload:edge(2),cycle:edge(3),
      map:edge(4)||edge(8),follow:edge(5),pause:edge(9),accept:edge(0),back:edge(1),
      activate:edge(7),up:edge(12),down:edge(13),left:edge(14),right:edge(15)});
    this.previous=held;return out;
  }
}
