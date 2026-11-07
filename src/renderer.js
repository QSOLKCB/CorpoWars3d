// SPDX-License-Identifier: Apache-2.0
// Original instanced renderer; QUICKSCOPER camera math and VANILLAJS/OPT's
// retained-capacity upload pattern. CPU-expanded WebGL 1 fallback is retained too.
import {perspective,view,multiply,transform,mix} from './math.js';
import {buildCity,PALETTE} from './city.js';
import {SCALE,COLORS,eyeOf,activeAgent} from './fps.js';
import {SoftwareRenderer} from './software-renderer.js';
import {objectiveKeys,currentObjectiveKey} from './objectives.js';
import {emitCharacter,skinKey,actorVariant,SKINS,actorAngle} from './skins.js';
// Beyond this distance (metres) characters drop their small detail parts.
export const CHARACTER_LOD_DISTANCE=38;
// A struck actor is self-lit for this long (simulation seconds).
export const HIT_FLASH=.12;
const CUBE=[];
for(const [n,v] of [
  [[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],
  [[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]],
  [[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
  [[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],
  [[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],
  [[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]]
])for(const i of [0,1,2,0,2,3])CUBE.push(...v[i].map(x=>x/2),...n);
const fragment=`precision mediump float;
varying vec3 vColor;varying vec3 vWorld;varying vec3 vNormal;varying float vGlow;
uniform vec3 eye;uniform float fog;uniform float clock;
void main(){
 float sunlight=max(dot(normalize(vNormal),normalize(vec3(-.4,.8,.35))),0.);
 float distanceToEye=length(vWorld-eye);
 float headlamp=max(0.,1.-distanceToEye/16.)*.30;
 vec3 lit=vColor*(.53+sunlight*.48+headlamp);
 lit=mix(lit,vColor*1.15,clamp(vGlow,0.,1.));
 float mist=1.-exp(-distanceToEye*.009*fog);
 gl_FragColor=vec4(mix(lit,vec3(.055,.09,.12),min(.92,mist)),1.);
}`;
const vertex=instanced=>`attribute vec3 position;attribute vec3 normal;
${instanced?'attribute vec3 iPosition;attribute vec3 iSize;attribute vec3 iColor;attribute vec3 iStyle;':'attribute vec3 color;attribute float glow;'}
uniform mat4 vp;varying vec3 vColor;varying vec3 vWorld;varying vec3 vNormal;varying float vGlow;
void main(){
 ${instanced?`vec3 p=position*iSize;float c=iStyle.x;float s=iStyle.y;
 vWorld=iPosition+vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);
 vNormal=vec3(normal.x*c+normal.z*s,normal.y,-normal.x*s+normal.z*c);
 vColor=iColor;vGlow=iStyle.z;`:'vWorld=position;vNormal=normal;vColor=color;vGlow=glow;'}
 gl_Position=vp*vec4(vWorld,1.);
}`;
function program(gl,vs,fs){
  const shaders=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,i)=>{
    const s=gl.createShader(type);gl.shaderSource(s,i?fs:vs);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;
  });
  const p=gl.createProgram();for(const s of shaders)gl.attachShader(p,s);gl.linkProgram(p);
  for(const s of shaders)gl.deleteShader(s);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
}
export class Batch {
  constructor(gl,capacity=1024){this.gl=gl;this.data=new Float32Array(capacity*12);this.count=0;this.buffer=gl.createBuffer();this.capacity=0;this.expanded=null;this.rotationAngle=null;this.rotationCos=1;this.rotationSin=0;this.rotationEvaluations=0;}
  clear(){this.count=0;this.rotationAngle=null;this.rotationEvaluations=0;return this;}
  box(x,y,z,w,h,d,color,glow=0,angle=0){
    if((this.count+1)*12>this.data.length){const data=new Float32Array(this.data.length*2);data.set(this.data);this.data=data;}
    const at=this.count++*12,v=this.data;
    v[at]=x;v[at+1]=y;v[at+2]=z;v[at+3]=w;v[at+4]=h;v[at+5]=d;
    // OPT-INV: contiguous cuboids reuse orientations with exact float32 parity.
    // Object.is preserves signed zero and NaN semantics.
    if(!Object.is(angle,this.rotationAngle)){
      this.rotationAngle=angle;
      this.rotationCos=angle===0?1:Math.cos(angle);
      this.rotationSin=angle===0?angle:Math.sin(angle);
      if(angle!==0)this.rotationEvaluations+=2;
    }
    v[at+6]=color[0];v[at+7]=color[1];v[at+8]=color[2];v[at+9]=this.rotationCos;v[at+10]=this.rotationSin;v[at+11]=glow;
  }
  // City builder already supplies packed cosine/sine and color channels.
  // Copy them exactly; atan2 -> cos/sin reconstruction and slice allocations
  // would add work while sometimes changing least-significant float bits.
  encoded(values){
    if(!values||values.length!==12)throw new RangeError('packed cuboid requires 12 floats');
    if((this.count+1)*12>this.data.length){
      const data=new Float32Array(this.data.length*2);data.set(this.data);this.data=data;
    }
    this.data.set(values,this.count++*12);
  }
}
export class Renderer {
  constructor(canvas,world){
    this.canvas=canvas;const options={antialias:false,alpha:false,powerPreference:'high-performance'};
    const gl=canvas.getContext('webgl2',options)||canvas.getContext('webgl',options);
    if(!gl)return new SoftwareRenderer(canvas,world);
    this.gl=gl;this.maxAttributes=gl.getParameter(gl.MAX_VERTEX_ATTRIBS);const ext=gl.drawArraysInstanced?null:gl.getExtension('ANGLE_instanced_arrays');
    this.instanced=Boolean(gl.drawArraysInstanced||ext);
    this.divisor=gl.vertexAttribDivisor?((a,n)=>gl.vertexAttribDivisor(a,n)):ext?((a,n)=>ext.vertexAttribDivisorANGLE(a,n)):()=>{};
    this.drawInstances=gl.drawArraysInstanced?((n)=>gl.drawArraysInstanced(gl.TRIANGLES,0,36,n)):ext?((n)=>ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,36,n)):null;
    this.p=program(gl,vertex(this.instanced),fragment);gl.useProgram(this.p);
    this.attr=Object.fromEntries(['position','normal','iPosition','iSize','iColor','iStyle','color','glow'].map(n=>[n,gl.getAttribLocation(this.p,n)]));
    this.uniform=Object.fromEntries(['vp','eye','fog','clock'].map(n=>[n,gl.getUniformLocation(this.p,n)]));
    this.cube=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.cube);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(CUBE),gl.STATIC_DRAW);
    this.static=new Batch(gl,16384);this.dynamic=new Batch(gl,2048);this.weapon=new Batch(gl,128);
    this.stats={draws:0,instances:0,uploadBytes:0,staticUploads:0,instanced:this.instanced};
    this.makeSigns();this.setWorld(world);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  }
  attribute(name,size,stride,offset,divisor=0){
    const gl=this.gl,a=this.attr[name];if(a<0)return;gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,stride,offset);this.divisor(a,divisor);
  }
  upload(batch,isStatic=false){
    const gl=this.gl;let data;
    if(this.instanced)data=batch.data.subarray(0,batch.count*12);
    else {
      const n=batch.count*36*10;
      if(!batch.expanded||batch.expanded.length<n)batch.expanded=new Float32Array(Math.max(n,(batch.expanded?.length||0)*2));
      const v=batch.data,out=batch.expanded;let at=0;
      for(let i=0;i<batch.count;i++){
        const j=i*12,c=v[j+9],s=v[j+10];
        for(let k=0;k<CUBE.length;k+=6){
          const x=CUBE[k]*v[j+3],y=CUBE[k+1]*v[j+4],z=CUBE[k+2]*v[j+5],nx=CUBE[k+3],ny=CUBE[k+4],nz=CUBE[k+5];
          out[at++]=v[j]+x*c+z*s;out[at++]=v[j+1]+y;out[at++]=v[j+2]-x*s+z*c;
          out[at++]=nx*c+nz*s;out[at++]=ny;out[at++]=-nx*s+nz*c;
          out[at++]=v[j+6];out[at++]=v[j+7];out[at++]=v[j+8];out[at++]=v[j+11];
        }
      }
      data=out.subarray(0,n);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);
    if(batch.capacity<data.byteLength){batch.capacity=Math.max(data.byteLength,batch.capacity*2);gl.bufferData(gl.ARRAY_BUFFER,batch.capacity,isStatic?gl.STATIC_DRAW:gl.DYNAMIC_DRAW);}
    if(data.length)gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
    if(isStatic)this.stats.staticUploads++;else this.stats.uploadBytes+=data.byteLength;
  }
  draw(batch){
    if(!batch.count)return;const gl=this.gl;
    if(this.instanced){
      gl.bindBuffer(gl.ARRAY_BUFFER,this.cube);this.attribute('position',3,24,0);this.attribute('normal',3,24,12);
      gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);
      for(const [n,i] of ['iPosition','iSize','iColor','iStyle'].map((n,i)=>[n,i]))this.attribute(n,3,48,i*12,1);
      this.drawInstances(batch.count);
    }else{
      gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);this.attribute('position',3,40,0);this.attribute('normal',3,40,12);this.attribute('color',3,40,24);this.attribute('glow',1,40,36);
      gl.drawArrays(gl.TRIANGLES,0,batch.count*36);
    }
    this.stats.draws++;this.stats.instances+=batch.count;
  }
  setWorld(world){
    if(this.world===world)return;this.world=world;
    const city=buildCity(world);this.static.clear();
    for(const v of city.boxes)this.static.encoded(v);
    this.upload(this.static,true);this.setSigns(city.signs);
  }
  resize(quality){
    const pixelRatio=Math.min(globalThis.devicePixelRatio||1,quality==='high'?1.5:1)*(quality==='low'?.7:1);
    const w=Math.max(1,Math.round(this.canvas.clientWidth*pixelRatio)),h=Math.max(1,Math.round(this.canvas.clientHeight*pixelRatio));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    this.gl.viewport(0,0,w,h);return w/h;
  }
  // Track hit points per actor id to flash a character the frame it is hurt.
  // Presentation only: the simulation already resolved the damage.
  trackHits(g){
    if(this.hitGame!==g){this.hitGame=g;this.lastHp=new Map();this.flashUntil=new Map();}
    const note=u=>{const last=this.lastHp.get(u.id);if(last!==undefined&&u.hp<last)this.flashUntil.set(u.id,g.time+HIT_FLASH);this.lastHp.set(u.id,u.hp);};
    for(const u of g.agents)note(u);for(const u of g.guards)note(u);if(g.courier)note(g.courier);
  }
  unit(batch,a,time,alpha,eye=null){
    const x=mix(a.prevX??a.x,a.x,alpha)*SCALE,z=mix(a.prevY??a.y,a.y,alpha)*SCALE;
    const angle=actorAngle(a.yaw||0),c=Math.cos(angle),s=Math.sin(angle),dead=a.hp<=0,key=skinKey(a);
    const moving=Math.abs(a.x-(a.prevX??a.x))+Math.abs(a.y-(a.prevY??a.y))>.001;
    const base=a.elevation||0,crouch=a.stance==='crouch'?.70:1;
    const far=eye&&Math.hypot(x-eye[0],z-eye[2])>CHARACTER_LOD_DISTANCE;
    const until=this.flashUntil?.get(a.id),flash=!dead&&until!==undefined&&time<until&&until-time<=HIT_FLASH;
    const box=this.partEmitter||(this.partEmitter=(dx,y,dz,w,h,d,col,glow)=>{
      const p=this.pose;p.batch.box(p.x+dx*p.c+dz*p.s,p.base+y*p.crouch,p.z-dx*p.s+dz*p.c,w,h*p.crouch,d,col,glow,p.angle);
    });
    const p=this.pose||(this.pose={});
    p.batch=batch;p.x=x;p.z=z;p.c=c;p.s=s;p.base=base;p.crouch=dead?1:crouch;p.angle=angle;
    const pose=this.characterPose||(this.characterPose={});
    pose.gait=moving?Math.sin(time*12+a.id):0;pose.dead=dead;pose.lod=far?'low':'high';pose.flash=flash;pose.variant=actorVariant(key,a.id);
    emitCharacter(box,key,pose);
    if(dead)return;
    // Ground ring: squad agents in their accent, the witness in gold.
    if(a.team==='agent')batch.box(x,.025,z,.7,.025,.7,COLORS[a.id],.5,angle);
    else if(a.team==='courier')batch.box(x,.025,z,.7,.025,.7,SKINS.witness.accent,.6,angle);
    if(a.stun>0)batch.box(x,base+2.1*crouch,z,.35,.07,.35,[.35,.6,1],1,angle);
  }
  beam(batch,a,b,width,color){
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
    if(length<.001)return;
    // Horizontal tracer body. Hit testing uses the exact three-dimensional ray.
    batch.box((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width,width,length,color,1,Math.atan2(dx,dz));
  }
  render(g,{alpha=1,menu=false,time=0,quality='high',reduced=false}={}){
    this.stats.draws=0;this.stats.instances=0;this.stats.uploadBytes=0;
    const gl=this.gl,a=activeAgent(g),aspect=this.resize(quality);let eye,yaw,pitch,fov;
    if(menu){eye=[48,31,88];yaw=-.35;pitch=-.42;fov=65;}
    else {
      eye=eyeOf(a);eye[0]=mix(a.prevX,a.x,alpha)*SCALE;eye[2]=mix(a.prevY,a.y,alpha)*SCALE;
      if(!reduced&&Math.abs(a.x-a.prevX)+Math.abs(a.y-a.prevY)>.0001)eye[1]+=Math.sin(g.time*12)*.025*(1-g.ads);
      yaw=a.yaw;pitch=a.pitch+(reduced?0:g.recoil*.012);fov=mix(83,43,g.ads);
    }
    const vp=multiply(perspective(fov*Math.PI/180,aspect,.05,240),view(eye,yaw,pitch));this.lastVP=vp;
    gl.clearColor(.055,.09,.12,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.p);
    gl.uniformMatrix4fv(this.uniform.vp,false,vp);gl.uniform3fv(this.uniform.eye,eye);gl.uniform1f(this.uniform.fog,1);
    gl.uniform1f(this.uniform.clock,time);this.draw(this.static);
    const batch=this.dynamic.clear();this.trackHits(g);
    for(const u of g.agents)if(menu||u.id!==g.viewId)this.unit(batch,u,g.time,alpha,eye);
    for(const u of g.guards)if(menu||u.id!==g.viewId)this.unit(batch,u,g.time,alpha,eye);
    if(g.courier?.active)this.unit(batch,g.courier,g.time,alpha,eye);
    const current=currentObjectiveKey(g);
    for(const [i,key] of objectiveKeys(g).entries()){
      // Completed and extraction: teal. Current: gold. Locked control nodes: grey.
      const p=g[key],c=p.done||key==='exit'?PALETTE.teal:key===current?PALETTE.gold:[.25,.29,.32];
      if(key!=='exit'){
        batch.box(p.x*SCALE,.6,p.y*SCALE,.65,1.2,.55,[.13,.20,.23]);
        batch.box(p.x*SCALE,1.1,p.y*SCALE-.29,.5,.32,.03,c,1);
      }else{
        batch.box(p.x*SCALE,.03,p.y*SCALE,3.4,.035,3.4,c,.7);
        for(const dx of [-1.5,1.5])batch.box(p.x*SCALE+dx,.7,p.y*SCALE,.12,1.4,.12,c,1);
      }
      const bob=reduced?0:Math.sin(time*2+i)*.1;
      batch.box(p.x*SCALE,2.6+bob,p.y*SCALE,.16,.16,.16,c,1,time*.6);
    }
    for(const t of g.tracers)this.beam(batch,t.origin,t.point,.017,PALETTE.gold);
    for(const e of g.effects)if(e.type==='shot')this.beam(batch,[e.x*SCALE,1.35,e.y*SCALE],[e.tx*SCALE,1.30,e.ty*SCALE],.018,e.team==='agent'?PALETTE.teal:PALETTE.red);
    for(const e of g.effects)if(e.type==='order')batch.box(e.x*SCALE,.04,e.y*SCALE,.5,.04,.5,PALETTE.gold,1);
    this.upload(batch);this.draw(batch);this.drawSigns(vp,eye);
    if(!menu&&!g.tactical){
      gl.useProgram(this.p);gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniform1f(this.uniform.fog,0);
      gl.uniform3fv(this.uniform.eye,[0,0,0]);gl.uniformMatrix4fv(this.uniform.vp,false,perspective(65*Math.PI/180,aspect,.03,10));
      const w=this.weapon.clear(),ads=g.ads,x=mix(.26,0,ads),reload=a.reload>0?Math.sin((1-a.reload/a.reloadTime)*Math.PI):0;
      const y=-.23-reload*.3,z=-.49+g.recoil*.055,c=COLORS[a.id],steel=[.10,.14,.16];
      w.box(x,y,z,.12,.12,.49,steel);w.box(x,y-.07,z+.17,.11,.23,.13,[.13,.19,.20]);
      w.box(x,y-.11,z-.02,.075,.22,.11,steel);w.box(x,y,z-.40,.045,.045,.42,steel);
      w.box(x,y+.09,z-.05,.075,.07,.19,steel);w.box(x,y+.135,z-.12,.055,.016,.016,c,1);
      w.box(x,y+.135,z+.03,.07,.016,.016,c,1);w.box(x+.064,y,z,.009,.045,.15,c,.7);
      w.box(x+.035,y-.10,z+.2,.11,.1,.16,[.21,.27,.28]);w.box(x-.04,y-.09,z-.17,.1,.09,.14,[.21,.27,.28]);
      w.box(x+.12,y-.21,z+.29,.18,.16,.35,[.11,.16,.19]);
      if(g.recoil>.7&&!reduced)w.box(x,y,z-.64,.11*g.recoil,.11*g.recoil,.15,PALETTE.gold,1);
      this.upload(w);this.draw(w);
    }
    gl.useProgram(this.p);
  }
  project(point){
    if(!this.lastVP)return null;const p=transform(this.lastVP,point);
    if(p[3]<=0||Math.abs(p[0]/p[3])>1.2||Math.abs(p[1]/p[3])>1.2)return null;
    return [(p[0]/p[3]*.5+.5)*this.canvas.clientWidth,(-p[1]/p[3]*.5+.5)*this.canvas.clientHeight];
  }
  makeSigns(){
    const gl=this.gl;this.signProgram=program(gl,`attribute vec3 position;attribute vec2 uv;uniform mat4 vp;varying vec2 tex;varying float depth;void main(){gl_Position=vp*vec4(position,1.);tex=uv;depth=gl_Position.w;}`,
      `precision mediump float;uniform sampler2D atlas;varying vec2 tex;varying float depth;void main(){vec3 c=texture2D(atlas,tex).rgb;gl_FragColor=vec4(mix(c,vec3(.055,.09,.12),min(.92,1.-exp(-depth*.009))),1.);}`);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;const ctx=canvas.getContext('2d');
    const names=['QSOL // IMC','DEBT IS FOREVER','CORPOWARS','WE OWN TOMORROW','MERIDIAN CREDIT','NULL & VOID','OBEY. CONSUME.','NO SHAREHOLDERS'];
    names.forEach((name,i)=>{
      ctx.fillStyle=i%2?'#1c292b':'#342920';ctx.fillRect(0,i*128,512,128);ctx.fillStyle=i%2?'#75d6c7':'#f0b55e';
      ctx.font='bold 35px monospace';ctx.textAlign='center';ctx.fillText(name,256,i*128+65);ctx.font='13px monospace';ctx.fillText('YOUR FUTURE IS OUR BUSINESS',256,i*128+99);
    });
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.signBuffer=gl.createBuffer();this.signAttributes=[gl.getAttribLocation(this.signProgram,'position'),gl.getAttribLocation(this.signProgram,'uv')];
    this.signVP=gl.getUniformLocation(this.signProgram,'vp');this.signAtlas=gl.getUniformLocation(this.signProgram,'atlas');
  }
  setSigns(signs){
    const data=[];
    for(const b of signs){
      const c=Math.cos(b.angle),s=Math.sin(b.angle);
      const vertices=[[-.5,-.5,0,1],[.5,-.5,1,1],[.5,.5,1,0],[-.5,.5,0,0]];
      for(const k of [0,1,2,0,2,3]){const [x,y,u,v]=vertices[k];data.push(b.x+x*b.w*c,b.y+y*b.h,b.z-x*b.w*s,u,(b.tile+v)/8);}
    }
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.signBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);this.signCount=data.length/5;
  }
  drawSigns(vp){
    const gl=this.gl;
    // Reset all active attributes and instance divisors before the atlas program.
    for(let i=0;i<this.maxAttributes;i++){gl.disableVertexAttribArray(i);this.divisor(i,0);}
    gl.useProgram(this.signProgram);gl.uniformMatrix4fv(this.signVP,false,vp);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.signAtlas,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.signBuffer);
    for(const [i,size,offset] of [[0,3,0],[1,2,12]]){const a=this.signAttributes[i];gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,20,offset);}
    gl.drawArrays(gl.TRIANGLES,0,this.signCount);this.stats.draws++;
  }
}
