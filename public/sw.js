// No cache of HTML, personalised responses, API calls, or personal documents.
const CACHE='mmg-static-v2';
const STATIC=['/styles.css','/icon.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
 self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!STATIC.includes(url.pathname))return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
