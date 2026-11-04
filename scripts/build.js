// SPDX-License-Identifier: Apache-2.0
import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'dist/';
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of ['index.html','style.css','icon.svg','sw.js','src','LICENSE','NOTICE'])await cp(root+path,out+path,{recursive:true});
console.log('Built allowlisted dist/ with native ES modules. No packages or network required.');
