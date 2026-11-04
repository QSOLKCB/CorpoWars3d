// SPDX-License-Identifier: Apache-2.0
// Bounded local evidence, not a cross-device performance guarantee.
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {cpus,platform,arch} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createOperation,update,command,setTactical,STEP} from '../src/fps.js';
const root=fileURLToPath(new URL('../',import.meta.url)),buffer=new ArrayBuffer(4),floats=new Float32Array(buffer),ints=new Uint32Array(buffer);
const native=x=>1/Math.sqrt(x);
function quake(x){floats[0]=x;ints[0]=0x5f3759df-(ints[0]>>>1);const y=floats[0];return y*(1.5-.5*x*y*y);}
const count=200000,values=Float64Array.from({length:count},(_,i)=>.001+(i*73%99991)/37);
let sink=0;
function sample(fn){const start=performance.now();let sum=0;for(const x of values)sum+=fn(x);sink+=sum;return performance.now()-start;}
for(let i=0;i<5;i++){sample(native);sample(quake);}
const n=[],q=[];
for(let i=0;i<9;i++){if(i%2){q.push(sample(quake));n.push(sample(native));}else{n.push(sample(native));q.push(sample(quake));}}
let error=0;for(const x of values)error=Math.max(error,Math.abs(quake(x)/native(x)-1));
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const simulation=[];
for(let index=0;index<6;index++){
  const samples=[];
  for(let repeat=0;repeat<5;repeat++){
    const g=createOperation(undefined,index);setTactical(g,true);command(g,'move',g.relay);const start=performance.now();
    for(let i=0;i<600;i++)update(g,{},STEP);samples.push(performance.now()-start);
  }
  simulation.push({mission:index+1,steps:600,samples_ms:samples,median_ms:median(samples)});
}
const hashes={};
async function hashFiles(path){for(const entry of await readdir(root+path,{withFileTypes:true})){const p=path+'/'+entry.name;if(entry.isDirectory())await hashFiles(p);else hashes[p]=createHash('sha256').update(await readFile(root+p)).digest('hex');}}
await hashFiles('src');hashes['scripts/benchmark.js']=createHash('sha256').update(await readFile(root+'scripts/benchmark.js')).digest('hex');
const report={schema:1,environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},
  math:{samples:count,repeats:9,native_ms:n,quake_one_newton_ms:q,native_median_ms:median(n),quake_median_ms:median(q),quake_max_relative_error:error,
    selected:'native Math.sqrt',reason:'Exact native arithmetic remains authoritative. One Newton iteration introduces approximation; no game-specific accuracy budget justifies replacing hit, collision or normalization math.'},simulation,source_sha256:hashes,sink,
  limits:'CPU simulation and arithmetic microbenchmarks only. These do not measure native GPU rendering, frame latency, browser input, or performance on the owner desktop.'};
if(process.argv.includes('--write'))await writeFile(root+'docs/PERFORMANCE_LOCAL.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({native_ms:median(n),quake_ms:median(q),max_relative_error:error,simulation_600_ticks_median_ms:simulation.map(s=>s.median_ms)},null,2));
