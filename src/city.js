// SPDX-License-Identifier: Apache-2.0
// Original procedural city. Boxes share one retained instanced draw batch.
import {SCALE} from './fps.js';
import {seededRandom} from './math.js';
export const PALETTE={road:[.055,.077,.085],kerb:[.14,.18,.19],steel:[.065,.105,.13],
  teal:[.28,.72,.65],gold:[1,.62,.23],red:[.95,.25,.20]};
export function buildCity(world) {
  const boxes=[],signs=[],rand=seededRandom(world.seed),size=world.size*SCALE;
  const accent=world.visualTheme==='violet'?[.56,.40,.94]:world.visualTheme==='crimson'?[.93,.29,.38]:null;
  const box=(x,y,z,w,h,d,color,glow=0,angle=0)=>boxes.push([x,y,z,w,h,d,...color,Math.cos(angle),Math.sin(angle),glow]);
  box(size/2,-.15,size/2,size,.3,size,PALETTE.road);
  // Ground markings, grates, puddles and raised service strips.
  for(let i=1;i<world.size;i+=9){
    const street=(i+1)*SCALE;
    for(let j=0;j<world.size;j+=2){
      box(street,.008,(j+.5)*SCALE,.09,.012,1.3,[.33,.37,.33]);
      box((j+.5)*SCALE,.008,street,1.3,.012,.09,[.33,.37,.33]);
    }
    for(let j=4;j<world.size;j+=9){
      box(street+1,.016,j*SCALE,1.1,.018,.8,[.035,.055,.06]);
      for(let k=0;k<5;k++)box(street+.6+k*.2,.03,j*SCALE,.035,.02,.72,[.18,.23,.24]);
      box(street-1,.018,(j+1)*SCALE,1.5,.015,2.4,[.09,.15,.17]);
    }
  }
  for(const [index,b] of world.buildings.entries()){
    const x=(b.x+b.w/2)*SCALE,z=(b.y+b.d/2)*SCALE,w=b.w*SCALE,d=b.d*SCALE,h=4+b.height*3.8;
    const tone=.045+b.tone*.045,color=[tone,tone+.033,tone+.05];
    box(x,.055,z,w+.65,.11,d+.65,PALETTE.kerb);
    box(x,h/2,z,w,h,d,color);
    box(x,.55,z,w+.05,1.1,d+.05,[.10,.14,.155]);
    box(x,h+.15,z,w+.3,.3,d+.3,[.12,.16,.18]);
    box(x,h+.55,z,w*.5,.8,d*.4,[.09,.13,.15]);
    const cyan=index%3!==0,lit=cyan?(accent??[.3,.65,.62]):[.84,.52,.25];
    for(let floor=2.3;floor<h-.7;floor+=1.75){
      for(let a=-w/2+.7;a<w/2-.4;a+=1.2){
        const c=rand()<.27?[.065,.12,.15]:lit,em=c===lit?.65:0;
        box(x+a,floor,z-d/2-.018,.6,.78,.035,c,em);
        box(x+a,floor,z+d/2+.018,.6,.78,.035,c,em);
      }
      for(let a=-d/2+.7;a<d/2-.4;a+=1.2){
        const c=rand()<.3?[.065,.12,.15]:lit;
        box(x-w/2-.018,floor,z+a,.035,.78,.6,c,c===lit?.65:0);
        box(x+w/2+.018,floor,z+a,.035,.78,.6,c,c===lit?.65:0);
      }
    }
    // Facade ribs, emissive edge seams and roof antennae.
    box(x-w/2-.025,h/2,z-d/2-.025,.07,h,.07,cyan?(accent??PALETTE.teal):PALETTE.gold,.9);
    box(x+w/2+.025,h/2,z+d/2+.025,.07,h,.07,cyan?(accent??PALETTE.teal):PALETTE.gold,.9);
    // Extra rooftop signal crowns are wholly decorative and above solid cover.
    if(accent&&index%3===0){
      box(x,h+.72,z,w*.68,.08,d*.68,accent,.75);
      for(const dx of [-w*.25,w*.25]){
        box(x+dx,h+1.38,z,.09,1.2,.09,accent,.8);
        box(x+dx,h+2.02,z,.34,.12,.34,accent,1);
      }
    }
    if(index%3===0){box(x,h+1.8,z,.08,3,.08,[.22,.28,.30]);box(x,h+3.35,z,.14,.16,.14,PALETTE.red,1);}
    // Every sign is a physical, original texture panel; one atlas, one draw.
    if(w>4){
      signs.push({x,y:3.8,z:z+d/2+.055,w:Math.min(w-.5,5.3),h:1.25,angle:0,tile:index%8});
      signs.push({x,y:3.8,z:z-d/2-.055,w:Math.min(w-.5,5.3),h:1.25,angle:Math.PI,tile:(index+3)%8});
    }
    if(index%2===0){
      const lx=x-w/2-.4,lz=z+d/2+.5;
      box(lx,1.6,lz,.1,3.2,.1,[.20,.24,.25]);box(lx,3.2,lz,.5,.07,.4,[.8,.88,.75],1);
    }
  }
  // Inaccessible perimeter matches the simulation's finite district.
  for(const edge of [[size/2,-.15,size,.3],[size/2,size+.15,size,.3],[-.15,size/2,.3,size],[size+.15,size/2,.3,size]]){
    box(edge[0],1.5,edge[1],edge[2],3,edge[3],[.06,.09,.12]);
    box(edge[0],3,edge[1],edge[2],.07,edge[3],PALETTE.gold,.8);
  }
  for(let i=0;i<24;i++){
    const side=i%4,t=(Math.floor(i/4)+.5)*size/6,h=18+rand()*38;
    const x=side===0?-13:side===1?size+13:t,z=side===2?-13:side===3?size+13:t;
    box(x,h/2,z,7+rand()*5,h,7+rand()*5,[.05,.08,.12]);
    box(x,h+.15,z,4,.12,4,i%2?PALETTE.teal:PALETTE.gold,.8);
  }
  return {boxes,signs};
}
