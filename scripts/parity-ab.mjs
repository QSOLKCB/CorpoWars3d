// SPDX-License-Identifier: Apache-2.0
// Exact A/B gate for simulation refactors (OPT records: reuse and reductions are
// only admitted when every later state is bit-identical).
//
//   node scripts/parity-ab.mjs [git-ref=HEAD] [--ticks=N] [--time]
//
// Exports `src/` at the reference commit next to the working tree, then drives
// both through identical seeded scenarios with live combat: every contract on
// both difficulties, tactical orders towards each objective, and stretches of
// scripted first-person movement, look, fire, reload and jumping. The complete
// serialised game state (typed arrays, Sets and Maps included) is hashed after
// every 60 Hz tick and must match on every tick. --time adds interleaved ABBA
// timing of the same workload; it is a CPU characterisation, not an FPS claim.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),ref=args.find(a=>!a.startsWith('--'))??'HEAD';
const ticks=Number(args.find(a=>a.startsWith('--ticks='))?.slice(8)??2400),timing=args.includes('--time');
const dir=mkdtempSync(join(tmpdir(),'corpowars3d-ab-'));
try {
  execFileSync('sh',['-c',`git -C "${root}" archive "${ref}" src | tar -x -C "${dir}"`]);
  const load=async base=>({
    fps:await import(pathToFileURL(join(base,'src/fps.js')).href),
    campaign:await import(pathToFileURL(join(base,'src/campaign.js')).href),
  });
  const before=await load(dir),after=await load(root);

  const replacer=(key,value)=>value instanceof Set?{$set:[...value]}:value instanceof Map?{$map:[...value]}:
    ArrayBuffer.isView(value)?{$typed:Array.from(value)}:typeof value==='number'&&!Number.isFinite(value)?{$num:String(value)}:Object.is(value,-0)?{$num:'-0'}:value;
  const hash=g=>createHash('sha1').update(JSON.stringify(g,replacer)).digest('hex');

  // One deterministic scenario: inputs depend only on the seed and on state,
  // so identical states receive identical inputs in both trees.
  function* scenario({fps,campaign},index,difficulty) {
    const c=campaign.createCampaign();c.difficulty=difficulty;
    const g=fps.createOperation(c,index);let s=(index+1)*7919+(difficulty==='hostile'?13:0),last='';
    const rand=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
    for(let t=0;t<ticks&&g.phase==='active';t++) {
      const phase=Math.floor(t/300)%3;
      if(phase===0&&!g.tactical){fps.setTactical(g,true);last='';}
      if(phase!==0&&g.tactical){fps.setTactical(g,false);if(t%600===300)fps.nextAgent(g);}
      const o=fps.objective(g);
      if(g.tactical&&o.key!==last){fps.command(g,'move',o.point);last=o.key;}
      if(g.courier?.active&&!g.escortFollowing&&t%240===0)fps.command(g,'escort');
      if(t%420===210)fps.command(g,['heal','emp','panic','fire','mode','follow'][Math.floor(rand()*6)]);
      let input={};
      if(!g.tactical) {
        fps.look(g,(rand()-.5)*40,(rand()-.5)*6);
        input={forward:rand()<.7?1:0,strafe:rand()<.2?(rand()<.5?-1:1):0,sprint:rand()<.3,crouch:rand()<.05,
          jump:rand()<.01,fire:rand()<.35,ads:rand()<.25};
        if(rand()<.004)fps.reload(g);
      }
      const started=performance.now();fps.update(g,input);const ms=performance.now()-started;
      yield {g,ms};
    }
  }

  let compared=0;const cases=[];
  for(let index=0;index<before.campaign.MISSIONS.length;index++)for(const difficulty of ['relaxed','hostile']) {
    const a=scenario(before,index,difficulty),b=scenario(after,index,difficulty);let t=0,phase='';
    for(;;) {
      const x=a.next(),y=b.next();
      if(x.done!==y.done)throw new Error(`mission ${index} ${difficulty}: run length differs at tick ${t}`);
      if(x.done)break;
      const hx=hash(x.value.g),hy=hash(y.value.g);
      if(hx!==hy)throw new Error(`mission ${index} ${difficulty}: state diverged at tick ${t+1}`);
      t++;compared++;phase=y.value.g.phase;
    }
    cases.push({mission:index,difficulty,ticks:t,phase});
  }
  const summary={reference:execFileSync('git',['-C',root,'rev-parse',ref]).toString().trim(),scenarios:cases.length,ticks_compared:compared,parity:'exact',
    outcomes:cases.map(c=>`${c.mission}/${c.difficulty[0]}:${c.phase}@${c.ticks}`).join(' ')};

  if(timing) {
    // Interleaved A B B A rounds over the whole workload, no hashing.
    const run=tree=>{let total=0,n=0;for(let index=0;index<tree.campaign.MISSIONS.length;index++)for(const d of ['relaxed','hostile'])for(const {ms} of scenario(tree,index,d)){total+=ms;n++;}return total/n*1000;};
    run(before);run(after);
    const A=[],B=[];for(let r=0;r<6;r++){if(r%2===0){A.push(run(before));B.push(run(after));}else{B.push(run(after));A.push(run(before));}}
    const median=v=>[...v].sort((p,q)=>p-q)[v.length>>1];
    const hashes={};for(const f of ['src/simulation.js','src/fps.js'])hashes[f]={reference:createHash('sha256').update(readFileSync(join(dir,f))).digest('hex'),candidate:createHash('sha256').update(readFileSync(join(root,f))).digest('hex')};
    Object.assign(summary,{reference_us_per_tick:A.map(v=>+v.toFixed(2)),candidate_us_per_tick:B.map(v=>+v.toFixed(2)),
      median_reference_us:+median(A).toFixed(2),median_candidate_us:+median(B).toFixed(2),node:process.version,source_sha256:hashes});
  }
  console.log(JSON.stringify(summary,null,2));
} finally { rmSync(dir,{recursive:true,force:true}); }
