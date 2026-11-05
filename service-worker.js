/* 11AM Politics — atomic complete-book offline reader.
 * Cache revision generated from Git blob hashes by scripts/build.py.
 * Browser storage can still be evicted by the browser or OS.
 */
const CACHE_PREFIX = '11am-politics-reader-';
const BOOK_CACHE = CACHE_PREFIX + 'cebc1c9c8f13';
const FONT_CACHE = '11am-politics-google-fonts-v1';
const SHELL = [
  './index.html', './manifest.webmanifest', './offline.js',
  './navigation.js', './navigation.css',
  './icons/icon-192.png', './icons/icon-512.png',
  './favicon-16.png', './favicon-32.png',
  './og-image.png', './404.html', './sitemap.xml'
];
const SCOPE = new URL(self.registration.scope);
const BOOK_URL = new URL('./index.html',SCOPE).href;

function isGoogleFont(url) {
  return url.protocol === 'https:' && (
    (url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css2')) ||
    (url.hostname === 'fonts.gstatic.com' && url.pathname.startsWith('/s/'))
  );
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(BOOK_CACHE);
    // Never activate a new release until *every* required resource is saved.
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names
      .filter(name=>name.startsWith(CACHE_PREFIX)&&name!==BOOK_CACHE)
      .map(name=>caches.delete(name)));
    // Do not remove other 11AM apps' caches or the reusable Google font cache.
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='PREPARE_FONTS')return;
  event.waitUntil((async()=>{
    const items=Array.isArray(event.data.urls)?event.data.urls.slice(0,50):[];
    const urls=[...new Set(items.filter(s=>typeof s==='string'&&s.length<2048))]
      .map(s=>{try{return new URL(s)}catch{return null}})
      .filter(u=>u&&isGoogleFont(u));
    const cache=await caches.open(FONT_CACHE);
    await Promise.allSettled(urls.map(async url=>{
      if(await cache.match(url.href,{ignoreVary:true}))return;
      const response=await fetch(url.href,{
        mode:url.hostname==='fonts.gstatic.com'?'cors':'no-cors',
        credentials:'omit'
      });
      if(response.ok||response.type==='opaque')await cache.put(url.href,response);
    }));
    event.ports?.[0]?.postMessage({type:'FONTS_PREPARED'});
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(isGoogleFont(url)){
    event.respondWith((async()=>{
      const cache=await caches.open(FONT_CACHE);
      const stored=await cache.match(request,{ignoreVary:true});
      if(stored)return stored;
      try{
        const response=await fetch(request);
        if(response.ok||response.type==='opaque')
          event.waitUntil(cache.put(request,response.clone()));
        return response;
      }catch{return Response.error()}
    })());
    return;
  }
  if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(BOOK_CACHE);
      const saved=await cache.match(BOOK_URL);
      if(saved)return saved;
      try{return await fetch(request)}catch{return Response.error()}
    })());
    return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(BOOK_CACHE);
    const stored=await cache.match(request);
    return stored||fetch(request);
  })());
});
