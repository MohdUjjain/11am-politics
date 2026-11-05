/* 11AM Politics: offline complete book, background edition updates. */
const CACHE_PREFIX = '11am-politics-reader-';
const BOOK_CACHE = CACHE_PREFIX + '5882ec1b4dee-pwa1';
const FONT_CACHE = '11am-politics-google-fonts-v1';
const SHELL = ['./index.html','./manifest.webmanifest','./offline.js','./icons/icon-192.png','./icons/icon-512.png'];
const SCOPE = new URL(self.registration.scope);
const BOOK_URL = new URL('./index.html',SCOPE).href;

function isGoogleFont(url) {
 return url.protocol === 'https:' && (
   (url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css2')) ||
   (url.hostname === 'fonts.gstatic.com' && url.pathname.startsWith('/s/'))
 );
}
self.addEventListener('install',(event)=>{
 event.waitUntil((async()=>{
  const cache = await caches.open(BOOK_CACHE);
  await cache.addAll(SHELL); // New worker activates only when the entire book is saved.
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',(event)=>{
 event.waitUntil((async()=>{
  const names = await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==BOOK_CACHE).map(n=>caches.delete(n)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',(event)=>{
 if(event.data?.type!=='PREPARE_FONTS')return;
 event.waitUntil((async()=>{
  const items = Array.isArray(event.data.urls)?event.data.urls.slice(0,50):[];
  const urls = [...new Set(items.filter(x=>typeof x==='string'&&x.length<2048))]
    .map(x=>{try{return new URL(x)}catch{return null}}).filter(x=>x&&isGoogleFont(x));
  const cache = await caches.open(FONT_CACHE);
  await Promise.allSettled(urls.map(async url=>{
   if(await cache.match(url.href,{ignoreVary:true}))return;
   const response=await fetch(url.href,{
     mode:url.hostname==='fonts.gstatic.com'?'cors':'no-cors',credentials:'omit'
   });
   if(response.ok||response.type==='opaque')await cache.put(url.href,response);
  }));
  event.ports?.[0]?.postMessage({type:'FONTS_PREPARED'});
 })());
});
async function refreshBook(){
 try{
  const response=await fetch(BOOK_URL,{cache:'no-store'});
  if(!response.ok||response.type!=='basic')return;
  const cache=await caches.open(BOOK_CACHE);
  const previous=await cache.match(BOOK_URL);
  const changed=!!previous&&(await previous.clone().text())!==(await response.clone().text());
  await cache.put(BOOK_URL,response); // Full new response saved before notifying.
  if(changed){
   const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   for(const client of clients)client.postMessage({type:'BOOK_UPDATED'});
  }
 }catch{/* Offline leaves cached book untouched. */}
}
self.addEventListener('fetch',(event)=>{
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
    if(response.ok||response.type==='opaque')await cache.put(request,response.clone());
    return response;
   }catch{return Response.error()}
  })());
  return;
 }
 if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(BOOK_CACHE);
   return (await cache.match(BOOK_URL))||fetch(request);
  })());
  event.waitUntil(refreshBook());
  return;
 }
 event.respondWith((async()=>{
  const stored=await caches.match(request);
  return stored||fetch(request);
 })());
});
