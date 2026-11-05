// SPDX-License-Identifier: Apache-2.0
// Native source-equivalent trig baseline vs the current retained-instance batch.
// CI characterisation only; measurements do not assert speedup or GPU FPS.
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {Batch} from '../src/renderer.js';

const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('src/renderer.js',root));
const sourceHash=createHash('sha256').update(source).digest('hex');
const scriptHash=createHash('sha256').update(readFileSync(new URL('scripts/benchmark_premium.mjs',root))).digest('hex');
const count=7000,params=Array.from({length:count},(_,i)=>({
  x:(i%101)*.25,y:(i%23)*.35,z:(i%59)*.20,
  w:1+(i%4)*.1,h:2+(i%7)*.25,d:1.2,
  color:[(i%7)/8,.15,.4],angle:i%17===0?(i%4)*Math.PI/4:0,glow:i%3/3,
}));
const gl={createBuffer:()=>({})};
function baseline(){
  const buffer=new Float32Array(count*12);
  for(let i=0;i<count;i++){
    const p=params[i],at=i*12;
    buffer[at]=p.x;buffer[at+1]=p.y;buffer[at+2]=p.z;
    buffer[at+3]=p.w;buffer[at+4]=p.h;buffer[at+5]=p.d;
    buffer[at+6]=p.color[0];buffer[at+7]=p.color[1];buffer[at+8]=p.color[2];
    buffer[at+9]=Math.cos(p.angle);buffer[at+10]=Math.sin(p.angle);buffer[at+11]=p.glow;
  }
  return buffer;
}
function current(){
  const batch=new Batch(gl,count);
  for(const p of params)batch.box(p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.glow,p.angle);
  return {buffer:batch.data.subarray(0,count*12),trigEvaluations:batch.rotationEvaluations};
}
const a=baseline(),b=current();
if(a.length!==b.buffer.length)throw new Error('different output lengths');
for(let i=0;i<a.length;i++)if(!Object.is(a[i],b.buffer[i]))throw new Error('GPU instance data mismatch at float '+i);
const samples={baseline:[],current:[]};
for(let rep=0;rep<11;rep++){
  const order=rep%2?['current','baseline']:['baseline','current'];
  for(const name of order){
    const before=performance.now();
    for(let k=0;k<4;k++)(name==='baseline'?baseline():current());
    const ms=performance.now()-before;
    if(rep>1)samples[name].push(ms/4);
  }
}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
const report={schema:'corpowars3d-opt-characterization/1',runtime:process.version,platform:process.platform,
  arch:process.arch,fixtures:{instances:count,iterationsPerSample:4,warmupPairs:2,measuredPairs:9},
  sourceSha256:sourceHash,benchmarkSha256:scriptHash,
  checks:{float32InstanceParity:true,trigEvaluations:b.trigEvaluations,
    baselineTrigCalls:count*2,uploadFloatCount:a.length},
  millisecondsPerRun:{baseline:samples.baseline,current:samples.current,
    baselineMedian:median(samples.baseline),currentMedian:median(samples.current)},
  caveat:'CPU wall-clock characterization only; no GPU/FPS speedup claim'};
const text=JSON.stringify(report,null,2)+'\n';
const index=process.argv.indexOf('--out');
if(index>=0){
  const path=process.argv[index+1];
  if(!path||path.startsWith('-'))throw new Error('Missing --out file');
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);
}
process.stdout.write(text);
