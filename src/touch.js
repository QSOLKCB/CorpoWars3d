// SPDX-License-Identifier: Apache-2.0
// Pointer ownership follows VANILLAJS's per-action / per-pointer input contract.
// No DOM or device state: lost capture, pause and resize have the same reset path.
import {stick} from './controller.js';
export class TouchInput {
  constructor(){this.pointers=new Map();this.clear();}
  clear(){this.pointers.clear();this.moveX=0;this.moveZ=0;this.lookX=0;this.lookY=0;}
  begin(id,kind,x=0,y=0){
    if(this.pointers.has(id)||(['move','look'].includes(kind)&&[...this.pointers.values()].some(p=>p.kind===kind)))return false;
    this.pointers.set(id,{kind,x,y,startX:x,startY:y});return true;
  }
  move(id,x,y){
    const p=this.pointers.get(id);if(!p||!Number.isFinite(x)||!Number.isFinite(y))return;
    if(p.kind==='move'){
      const [sx,sy]=stick((x-p.startX)/48,(y-p.startY)/48,.08);this.moveX=sx;this.moveZ=-sy;
    }else if(p.kind==='look'||p.kind==='fire'){
      this.lookX= Math.max(-250,Math.min(250,this.lookX+x-p.x));
      this.lookY= Math.max(-250,Math.min(250,this.lookY+y-p.y));
    }
    p.x=x;p.y=y;
  }
  end(id,cancel=false){const p=this.pointers.get(id);if(cancel&&(p?.kind==='look'||p?.kind==='fire')){this.lookX=0;this.lookY=0;}this.pointers.delete(id);if(p?.kind==='move'){this.moveX=0;this.moveZ=0;}}
  held(kind){for(const p of this.pointers.values())if(p.kind===kind)return true;return false;}
  consumeLook(){const out=[this.lookX,this.lookY];this.lookX=0;this.lookY=0;return out;}
}
