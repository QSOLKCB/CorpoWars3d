// SPDX-License-Identifier: Apache-2.0
// Compare equivalent baseline/current instance preparation and check exact parity.
// Fixed fixture and alternated A/B order; CPU evidence, not GPU FPS certification.
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {Batch} from '../src/renderer.js';
import {createWorld} from '../src/simulation.js';
import {buildCity} from '../src/city.js';

const root=new URL('../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const dynamic=Array.from({length:7000},(_,i)=>({
  x:(i%101)*.25,y:(i%23)*.35,z:(i%59)*.20,w:1+(i%4)*.1,
  h:2+(i%7)*.25,d:1.2,color:[(i%7)/8,.15,.4],
  angle:i%17===0?(i%4)*Math.PI/4:0,glow:i%3/3,
}));
const staticBoxes=buildCity(createWorld(7229,3)).boxes;
const gl={createBuffer:()=>({})};
class LegacyBatch {
  constructor(capacity){this.data=new Float32Array(capacity*12);this.count=0;}
  box(x,y,z,w,h,d,color,glow=0,angle=0){
    if((this.count+1)*12>this.data.length){
      const data=new Float32Array(this.data.length*2);data.set(this.data);this.data=data;
    }
    const at=this.count++*12,v=this.data;
    v[at]=x;v[at+1]=y;v[at+2]=z;v[at+3]=w;v[at+4]=h;v[at+5]=d;
    v[at+6]=color[0];v[at+7]=color[1];v[at+8]=color[2];
    v[at+9]=Math.cos(angle);v[at+10]=Math.sin(angle);v[at+11]=glow;
  }
}
function legacyDynamic(){
  const batch=new LegacyBatch(dynamic.length);
  for(const p of dynamic)batch.box(p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.glow,p.angle);
  return batch.data;
}
function currentDynamic(){
  const batch=new Batch(gl,dynamic.length);
  for(const p of dynamic)batch.box(p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.glow,p.angle);
  return {data:batch.data,trigEvaluations:batch.rotationEvaluations};
}
function legacyStatic(){
  const batch=new LegacyBatch(staticBoxes.length);
  for(const v of staticBoxes)batch.box(v[0],v[1],v[2],v[3],v[4],v[5],v.slice(6,9),v[11],Math.atan2(v[10],v[9]));
  return batch.data;
}
function currentStatic(){
  const batch=new Batch(gl,staticBoxes.length);
  for(const v of staticBoxes)batch.encoded(v);
  return batch.data;
}
function parity(a,b,label){
  if(a.length!==b.length)throw new Error(label+': output length changed');
  for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))throw new Error(label+': float32 mismatch at '+i);
}
const optimizedDynamic=currentDynamic();
parity(legacyDynamic(),optimizedDynamic.data,'dynamic');
parity(legacyStatic(),currentStatic(),'static');
const measurements={};
for(const [label,legacy,current] of [
  ['dynamic',legacyDynamic,()=>currentDynamic().data],
  ['static',legacyStatic,currentStatic]
]){
  const samples={legacy:[],current:[]};
  for(let rep=0;rep<11;rep++){
    const order=rep%2?['current','legacy']:['legacy','current'];
    for(const name of order){
      const f=name==='legacy'?legacy:current;
      const start=performance.now();
      for(let k=0;k<4;k++)f();
      if(rep>1)samples[name].push((performance.now()-start)/4);
    }
  }
  const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
  measurements[label]={instances:label==='dynamic'?dynamic.length:staticBoxes.length,
    legacyMs:samples.legacy,currentMs:samples.current,
    legacyMedian:median(samples.legacy),currentMedian:median(samples.current)};
}
const report={schema:'corpowars3d-opt-characterization/2',
  runtime:process.version,platform:process.platform,arch:process.arch,
  fixtures:{warmupPairs:2,measuredPairs:9,iterationsPerSample:4,seed:7229,layout:3},
  sourceSha256:hash(readFileSync(new URL('src/renderer.js',root))),
  benchmarkSha256:hash(readFileSync(new URL('scripts/benchmark_premium.mjs',root))),
  checks:{float32InstanceParity:true,dynamicTrigEvaluations:optimizedDynamic.trigEvaluations,
    legacyDynamicTrigCalls:dynamic.length*2},
  measurements,caveat:'A/B CPU preparation only; no GPU or FPS speedup certification'};
const reportText=JSON.stringify(report,null,2)+'\n';
const arg=process.argv.indexOf('--out');
if(arg>=0){const path=process.argv[arg+1];if(!path||path.startsWith('-'))throw new Error('invalid --out');
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,reportText);}
process.stdout.write(reportText);
