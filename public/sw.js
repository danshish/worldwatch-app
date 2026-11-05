const CACHE='worldwatch-v2';
const SHELL=['/','/index.html','/manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  const request=event.request;
  const path=new URL(request.url).pathname;
  const isAppCode=/\\.(js|css|html)$/.test(path)||path==='/';
  if(isAppCode){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html'))));
  }else{
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match('/index.html'))));
  }
});