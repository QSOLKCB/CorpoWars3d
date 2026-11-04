// SPDX-License-Identifier: Apache-2.0
// Scope-specific, optional offline cache. Bump VERSION whenever runtime changes.
const VERSION='0.1.0-5',PREFIX='corpowars3d:'+self.registration.scope+':',CACHE=PREFIX+VERSION;
const FILES=['./','./index.html','./style.css','./icon.svg','./src/main.js','./src/fps.js','./src/simulation.js','./src/campaign.js','./src/challenges.js','./src/math.js','./src/city.js','./src/renderer.js','./src/software-renderer.js','./src/audio.js','./src/music.js','./src/vendor/time.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(event.request.mode==='navigate'){
      try{return await fetch(event.request);}catch{return await cache.match('./index.html')||Response.error();}
    }
    const cached=await cache.match(event.request,{ignoreSearch:true});return cached||fetch(event.request);
  })());
});
