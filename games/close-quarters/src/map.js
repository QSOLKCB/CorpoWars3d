// SPDX-License-Identifier: Apache-2.0
// Tactical view: cached static tiles; dynamic actors and routes are separate.
import {visibleGuard} from '../../../src/simulation.js';
import {COLORS, objective} from '../../../src/fps.js';
const cache=new WeakMap();
export function mapCoordinates(clientX,clientY,rect,size) {
  if(!Number.isFinite(clientX)||!Number.isFinite(clientY)||!rect.width||!rect.height)return null;
  return {x:Math.max(0,Math.min(size-1e-6,(clientX-rect.left)/rect.width*size)),
    y:Math.max(0,Math.min(size-1e-6,(clientY-rect.top)/rect.height*size))};
}
function staticMap(g,canvas) {
  let back=cache.get(g.world);
  if(back&&back.width===canvas.width&&back.height===canvas.height)return back;
  back=document.createElement('canvas');back.width=canvas.width;back.height=canvas.height;
  const c=back.getContext('2d'),s=back.width/g.world.size,n=g.world.size;
  c.fillStyle='#0b1720';c.fillRect(0,0,back.width,back.height);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const id=y*n+x;
    if(g.world.blocked[id]){
      c.fillStyle=(x+y)%2?'#27404a':'#20353e';c.fillRect(x*s,y*s,s+.3,s+.3);
    }else if((x+y)%3===0){c.fillStyle='#17303a';c.fillRect(x*s,y*s,s,s);}
  }
  c.strokeStyle='#45616b44';c.lineWidth=1;
  for(let i=0;i<=n;i++){const t=i*s;c.beginPath();c.moveTo(t,0);c.lineTo(t,n*s);c.moveTo(0,t);c.lineTo(n*s,t);c.stroke();}
  for(const b of g.world.buildings){c.strokeStyle='#50798577';c.lineWidth=1;c.strokeRect(b.x*s,b.y*s,b.w*s,b.d*s);}
  cache.set(g.world,back);return back;
}
export function drawTactical(g,canvas,{labels=false}={}) {
  const c=canvas.getContext('2d');if(!c)return;
  c.setTransform(1,0,0,1,0,0);
  c.drawImage(staticMap(g,canvas),0,0);
  const s=canvas.width/g.world.size;
  for(const a of g.agents)if(a.hp>0&&a.path.length){
    c.strokeStyle='#82f2d388';c.lineWidth=2;c.beginPath();c.moveTo(a.x*s,a.y*s);
    for(const p of a.path)c.lineTo(p.x*s,p.y*s);c.stroke();
  }
  const current=objective(g);
  for(const [i,name] of ['relay','vault','exit'].entries()) {
    const p=g[name];c.fillStyle=p.done?'#6af2c0':current.key===name?'#ffd07a':'#8fa3b0';
    c.beginPath();c.moveTo(p.x*s,(p.y-.32)*s);c.lineTo((p.x+.32)*s,p.y*s);
    c.lineTo(p.x*s,(p.y+.32)*s);c.lineTo((p.x-.32)*s,p.y*s);c.closePath();c.fill();
    if(labels){c.font='11px monospace';c.fillText(name.toUpperCase(),(p.x+.4)*s,(p.y-.3)*s);}
  }
  for(const e of g.guards)if(e.hp>0&&visibleGuard(g,e)){
    c.fillStyle=e.boss?'#fcad56':'#ff6c6e';c.fillRect(e.x*s-5,e.y*s-5,10,10);
    if(e.boss){c.strokeStyle='#fff';c.strokeRect(e.x*s-7,e.y*s-7,14,14);}
  }
  for(const a of g.agents){
    if(a.hp<=0)continue;
    const color='rgb('+COLORS[a.id].map(x=>Math.round(x*255)).join(' ')+')';
    c.fillStyle=color;c.beginPath();c.arc(a.x*s,a.y*s,a.id===g.viewId?9:6,0,Math.PI*2);c.fill();
    if(g.selected.has(a.id)){c.lineWidth=2;c.strokeStyle='#eef8f6';c.beginPath();c.arc(a.x*s,a.y*s,12,0,Math.PI*2);c.stroke();}
    c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(a.x*s,a.y*s);
    c.lineTo(a.x*s+Math.sin(a.yaw)*17,a.y*s-Math.cos(a.yaw)*17);c.stroke();
    if(labels){c.font='bold 12px monospace';c.fillStyle='#d3f9f2';c.fillText(a.name,a.x*s+12,a.y*s-10);}
  }
}
