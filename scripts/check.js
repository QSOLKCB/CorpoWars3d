// SPDX-License-Identifier: Apache-2.0
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(path){let out=[];for(const item of await readdir(root+path,{withFileTypes:true})){const p=path+'/'+item.name;if(item.isDirectory())out.push(...await files(p));else if(p.endsWith('.js'))out.push(p);}return out;}
const paths=[...await files('src'),...await files('scripts'),...await files('tests'),'sw.js'];
for(const path of paths){const r=spawnSync(process.execPath,['--check',root+path],{encoding:'utf8'});if(r.status)throw new Error(path+'\n'+r.stderr);}
for(const path of await files('src')){
  const text=await readFile(root+path,'utf8');
  for(const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)){
    if(!match[1].startsWith('./'))throw new Error('Nonlocal runtime import in '+path);
    await readFile(new URL(match[1],new URL(path,'file://'+root)));
  }
}
const html=await readFile(root+'index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate HTML IDs');
if(/https?:\/\/|cdn\./i.test(html))throw new Error('Remote runtime resource in HTML');
console.log(`Checked ${paths.length} JavaScript files, local module graph and HTML IDs.`);
