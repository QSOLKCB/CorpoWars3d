// SPDX-License-Identifier: Apache-2.0
// Low-detail compatibility path for devices without WebGL. Same simulation,
// camera and hit tests; CPU projection with clipped, depth-sorted convex faces.
// Intersecting translucent geometry and physical reflections are not supported.
import {perspective,view,multiply,transform,mix} from './math.js';
import {SCALE,COLORS,eyeOf,activeAgent} from './fps.js';
import {lineOfSight} from './simulation.js';
import {objectiveKeys,currentObjectiveKey} from './objectives.js';
import {emitCharacter,skinKey,actorVariant,SKINS,actorAngle} from './skins.js';
const FACES=[
  {n:[0,1,0],p:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]},
  {n:[0,-1,0],p:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]},
  {n:[0,0,1],p:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},
  {n:[0,0,-1],p:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]},
  {n:[1,0,0],p:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]},
  {n:[-1,0,0],p:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]}
];
const SKY=[.055,.09,.12];
function clipNear(points){
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],inside=a[3]>=.06,next=b[3]>=.06;
    if(inside)out.push(a);
    if(inside!==next){const t=(.06-a[3])/(b[3]-a[3]);out.push(a.map((v,j)=>mix(v,b[j],t)));}
  }
  return out;
}
export class SoftwareRenderer {
  constructor(canvas,world){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Graphics are unavailable. Enable browser hardware acceleration and reload.');
    this.instanced=false;this.software=true;this.stats={draws:0,instances:0,uploadBytes:0,staticUploads:0,instanced:false,backend:'Canvas 2D software 3D'};
    this.faces=[];this.setWorld(world);
  }
  setWorld(world){
    this.world=world;this.backdropKey=null;this.backdrop=null;this.static=[];const box=(...args)=>this.static.push(args),n=world.size*SCALE;
    box(n/2,-.12,n/2,n,.2,n,[.075,.105,.115]);
    for(const [i,b] of world.buildings.entries()){
      const x=(b.x+b.w/2)*SCALE,z=(b.y+b.d/2)*SCALE,w=b.w*SCALE,d=b.d*SCALE,h=4+b.height*3.8;
      box(x,.06,z,w+.6,.12,d+.6,[.16,.21,.22]);
      box(x,h/2,z,w,h,d,[.065+b.tone*.045,.115+b.tone*.025,.145+b.tone*.03]);
      box(x,h+.12,z,w+.15,.24,d+.15,[.18,.24,.25]);
      const color=i%3?[.29,.59,.56]:[.80,.52,.28];
      // Flat window panels share real facade depths and obey painter ordering.
      for(let y=2.4;y<h-.6;y+=2.4){
        box(x,y,z+d/2+.02,w*.84,.55,.035,color,.6);
        box(x,y,z-d/2-.02,w*.84,.55,.035,color,.6);
        box(x+w/2+.02,y,z,.035,.55,d*.84,color,.6);
        box(x-w/2-.02,y,z,.035,.55,d*.84,color,.6);
      }
      box(x-w/2-.03,h/2,z-d/2-.03,.07,h,.07,color,1);
    }
    // Long road markings, rendered once as flat cuboids.
    for(let k=2;k<world.size;k+=9){
      for(let j=0;j<world.size;j+=3){box(k*SCALE,.006,j*SCALE,.06,.01,2,[.34,.37,.32]);box(j*SCALE,.006,k*SCALE,2,.01,.06,[.34,.37,.32]);}
    }
    for(const e of [[n/2,-.15,n,.3],[n/2,n+.15,n,.3],[-.15,n/2,.3,n],[n+.15,n/2,.3,n]])box(e[0],1.5,e[1],e[2],3,e[3],[.09,.13,.16]);
  }
  box(x,y,z,w,h,d,color,glow=0,angle=0){
    const cs=Math.cos(angle),sn=Math.sin(angle),dx=x-this.eye[0],dz=z-this.eye[2],distance=Math.hypot(dx,y-this.eye[1],dz);
    this.stats.instances++;
    if(distance>170||distance>35&&w<.2&&h<.2&&d<.2)return;
    for(const f of FACES){
      const normal=[f.n[0]*cs+f.n[2]*sn,f.n[1],-f.n[0]*sn+f.n[2]*cs];
      const center=[x+normal[0]*(f.n[0]?w:d)/2,y+normal[1]*h/2,z+normal[2]*(f.n[0]?w:d)/2];
      if(normal[0]*(this.eye[0]-center[0])+normal[1]*(this.eye[1]-center[1])+normal[2]*(this.eye[2]-center[2])<=0)continue;
      const points=f.p.map(v=>{
        const px=v[0]*w/2,py=v[1]*h/2,pz=v[2]*d/2;
        return transform(this.lastVP,[x+px*cs+pz*sn,y+py,z-px*sn+pz*cs]);
      });
      const clipped=clipNear(points);if(clipped.length<3)continue;
      const screen=clipped.map(p=>[(p[0]/p[3]*.5+.5)*this.canvas.width,(-p[1]/p[3]*.5+.5)*this.canvas.height]);
      if(screen.every(p=>p[0]<0)||screen.every(p=>p[0]>this.canvas.width)||screen.every(p=>p[1]<0)||screen.every(p=>p[1]>this.canvas.height))continue;
      const sunlight=Math.max(0,-normal[0]*.4+normal[1]*.8+normal[2]*.35);
      const shade=glow?1.05:.53+sunlight*.48+Math.max(0,1-distance/16)*.3,fog=Math.min(.92,1-Math.exp(-distance*.009));
      const rgb=color.map((c,i)=>Math.round(Math.max(0,Math.min(1,mix(c*shade,SKY[i],fog)))*255));
      this.faces.push({screen,depth:clipped.reduce((n,p)=>n+p[3],0)/clipped.length,color:`rgb(${rgb.join(' ')})`});
    }
  }
  paint(){
    const c=this.ctx;this.faces.sort((a,b)=>b.depth-a.depth);
    for(const f of this.faces){c.beginPath();c.moveTo(...f.screen[0]);for(let i=1;i<f.screen.length;i++)c.lineTo(...f.screen[i]);c.closePath();c.fillStyle=f.color;c.fill();this.stats.draws++;}
    this.faces.length=0;
  }
  // Same skins as WebGL at their low level of detail: the CPU path sorts
  // every face, so it keeps roughly its previous part budget per character.
  unit(a,time,alpha){
    if(a.hp<=0)return;
    const x=mix(a.prevX??a.x,a.x,alpha)*SCALE,z=mix(a.prevY??a.y,a.y,alpha)*SCALE,angle=actorAngle(a.yaw||0),c=Math.cos(angle),s=Math.sin(angle);
    const base=a.elevation||0,crouch=a.stance==='crouch'?.7:1;
    const moving=Math.abs(a.x-a.prevX)+Math.abs(a.y-a.prevY)>.001,key=skinKey(a);
    emitCharacter((dx,y,dz,w,h,d,col,glow)=>this.box(x+dx*c+dz*s,base+y*crouch,z-dx*s+dz*c,w,h*crouch,d,col,glow,angle),
      key,{gait:moving?Math.sin(time*12+a.id):0,dead:false,lod:'low',flash:false,variant:actorVariant(key,a.id)});
    if(a.team==='agent')this.box(x,.025,z,.65,.025,.65,COLORS[a.id],.7);
    else if(a.team==='courier')this.box(x,.025,z,.65,.025,.65,SKINS.witness.accent,.7);
  }
  render(g,{alpha=1,menu=false,time=0,quality='high',reduced=false}={}){
    const started=performance.now();
    const a=activeAgent(g),canvas=this.canvas,c=this.ctx,ratio=quality==='low'?.7:1;
    const width=Math.max(1,Math.round(canvas.clientWidth*ratio)),height=Math.max(1,Math.round(canvas.clientHeight*ratio));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    this.stats.draws=0;this.stats.instances=0;
    let eye,yaw,pitch,fov;
    if(menu){eye=[48,31,88];yaw=-.35;pitch=-.42;fov=65;}
    else {eye=eyeOf(a);eye[0]=mix(a.prevX,a.x,alpha)*SCALE;eye[2]=mix(a.prevY,a.y,alpha)*SCALE;yaw=a.yaw;pitch=a.pitch;fov=mix(83,43,g.ads);}
    this.eye=eye;this.lastVP=multiply(perspective(fov*Math.PI/180,width/height,.06,240),view(eye,yaw,pitch));
    const vp=this.lastVP;
    // One exact static-view cache: bounded capacity, complete camera key, and
    // invalidation on world replacement. Moving cameras always reconstruct it.
    const key=[width,height,...eye,yaw,pitch,fov].join(',');
    if(this.backdropKey!==key){
      const sky=c.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#0e1925');sky.addColorStop(1,'#2a444a');c.fillStyle=sky;c.fillRect(0,0,width,height);
      for(const b of this.static)this.box(...b);this.paint();
      if(!this.backdrop)this.backdrop=document.createElement('canvas');
      this.backdrop.width=width;this.backdrop.height=height;this.backdrop.getContext('2d').drawImage(canvas,0,0);this.backdropKey=key;
      this.stats.cacheMisses=(this.stats.cacheMisses||0)+1;
    }else{c.drawImage(this.backdrop,0,0);this.stats.draws++;this.stats.cacheHits=(this.stats.cacheHits||0)+1;}
    for(const u of [...g.agents,...g.guards])if((menu||u.id!==g.viewId)&&(menu||lineOfSight(g.world,a,u)))this.unit(u,g.time,alpha);
    if(g.courier?.active&&(menu||lineOfSight(g.world,a,g.courier)))this.unit(g.courier,g.time,alpha);
    const current=currentObjectiveKey(g);
    for(const [i,key] of objectiveKeys(g).entries()){
      const p=g[key],col=p.done||key==='exit'?[.35,.8,.7]:key===current?[.95,.65,.28]:[.25,.29,.32];
      if(!menu&&!lineOfSight(g.world,a,p))continue;
      this.box(p.x*SCALE,key==='exit'?.03:.6,p.y*SCALE,key==='exit'?3.4:.65,key==='exit'?.04:1.2,key==='exit'?3.4:.55,key==='exit'?col:[.17,.25,.27]);
      this.box(p.x*SCALE,2.6+(reduced?0:Math.sin(time*2+i)*.1),p.y*SCALE,.18,.18,.18,col,1);
    }
    this.paint();
    // Exact hits are already resolved in the simulation; tracers are cosmetic.
    for(const t of g.tracers){const p=this.project(t.origin),q=this.project(t.point);if(p&&q){c.strokeStyle='#f4bd69';c.lineWidth=2;c.beginPath();c.moveTo(p[0]*ratio,p[1]*ratio);c.lineTo(q[0]*ratio,q[1]*ratio);c.stroke();}}
    if(!menu&&!g.tactical){
      this.eye=[0,0,0];this.lastVP=perspective(65*Math.PI/180,width/height,.03,10);
      const x=mix(.26,0,g.ads),r=a.reload>0?Math.sin((1-a.reload/a.reloadTime)*Math.PI):0,y=-.23-r*.3,z=-.49+g.recoil*.055;
      const metal=[.12,.19,.22];
      this.box(x,y,z,.12,.12,.49,metal);this.box(x,y-.07,z+.17,.11,.23,.13,metal);this.box(x,y-.11,z-.02,.075,.22,.11,metal);
      this.box(x,y,z-.40,.045,.045,.42,metal);this.box(x,y+.09,z-.05,.075,.07,.19,metal);
      this.box(x,y+.135,z-.12,.055,.016,.016,COLORS[a.id],1);this.box(x+.06,y,z,.01,.04,.15,COLORS[a.id],.8);
      this.box(x+.035,y-.10,z+.2,.11,.10,.16,[.25,.30,.30]);this.box(x-.04,y-.09,z-.17,.10,.09,.14,[.25,.30,.30]);
      if(g.recoil>.7&&!reduced)this.box(x,y,z-.64,.12,.12,.15,[1,.7,.3],1);
      this.paint();
    }
    this.lastVP=vp;this.stats.cpuMs=performance.now()-started;
  }
  project(point){
    const p=transform(this.lastVP,point);if(p[3]<=.06||Math.abs(p[0]/p[3])>1.3||Math.abs(p[1]/p[3])>1.3)return null;
    return [(p[0]/p[3]*.5+.5)*this.canvas.clientWidth,(-p[1]/p[3]*.5+.5)*this.canvas.clientHeight];
  }
}
