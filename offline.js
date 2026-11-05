/* Installation, complete-book status and longer-lived storage request. */
(()=>{
 'use strict';
 const toggle=document.getElementById('offlineToggle');
 const details=document.getElementById('offlineDetails');
 const message=document.getElementById('offlineMessage');
 const keep=document.getElementById('offlineKeep');
 const install=document.getElementById('offlineInstall');
 const reload=document.getElementById('offlineReload');
 const CACHE_PREFIX='11am-politics-reader-';
 const ESSENTIALS=['./index.html','./manifest.webmanifest','./offline.js','./icons/icon-192.png','./icons/icon-512.png','./favicon-16.png','./favicon-32.png','./og-image.png','./404.html','./sitemap.xml'];
 let installPrompt=null,registration=null,updated=false,lastChecked=0;
 let previousController=!!navigator.serviceWorker?.controller;
 function setStatus(label,explanation){if(!updated)toggle.textContent=label;message.textContent=explanation;}
 toggle.addEventListener('click',()=>{
  details.hidden=!details.hidden;
  toggle.setAttribute('aria-expanded',String(!details.hidden));
 });
 window.addEventListener('beforeinstallprompt',(e)=>{
  e.preventDefault();installPrompt=e;install.hidden=false;
 });
 window.addEventListener('appinstalled',()=>{install.hidden=true;installPrompt=null});
 install.addEventListener('click',async()=>{
  if(!installPrompt)return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt=null;install.hidden=true;
 });
 reload.addEventListener('click',()=>location.reload());
 async function checkOffline(){
  try{
   const names=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX));
   let ready=false;
   for(const name of names.reverse()){
    const cache=await caches.open(name);
    if((await Promise.all(ESSENTIALS.map(path=>cache.match(path)))).every(Boolean)){
     ready=true;break;
    }
   }
   const persisted=navigator.storage?.persisted?await navigator.storage.persisted():false;
   keep.disabled=!ready||!!persisted;
   keep.textContent=persisted?'Persistent storage enabled':'Keep on this device';
   if(ready)setStatus('✓ Available offline',persisted?
     'All 20 chapters are saved. Persistent browser storage is enabled.':
     'All 20 chapters are saved. For longer retention, choose “Keep on this device”.');
   else setStatus('⏳ Saving offline…','Preparing the complete 20-chapter guide for offline use.');
  }catch{setStatus('Offline status unavailable','Browser storage could not be checked.')}
 }
 keep.addEventListener('click',async()=>{
  keep.disabled=true;
  try{
   const granted=!!(navigator.storage?.persist&&await navigator.storage.persist());
   await checkOffline();
   if(!granted)message.textContent='The guide remains saved offline, but this browser did not grant persistent storage. Device cleanup may remove it.';
  }catch{
   message.textContent='Offline reading remains available; persistent storage is unsupported here.';
   keep.disabled=false;
  }
 });
 function announceUpdate(){
  updated=true;toggle.textContent='↻ New edition ready';
  reload.hidden=false;
  message.textContent='An updated edition has been saved. Reload to read it.';
 }
 if(!('serviceWorker' in navigator)||!('caches' in window)){
  setStatus('Offline unavailable','This browser does not support offline app caching.');
  keep.hidden=true;return;
 }
 async function prepareFonts(){
  if(!navigator.onLine||!registration?.active)return;
  try{
   if(document.fonts?.load){
    await Promise.allSettled([
     '400 16px "Fraunces"','600 16px "Fraunces"','700 16px "Fraunces"','900 16px "Fraunces"',
     '400 16px "Source Sans 3"','700 16px "Source Sans 3"',
     '400 14px "IBM Plex Mono"','600 14px "IBM Plex Mono"'
    ].map(spec=>document.fonts.load(spec,'Politics Study Notes')));
   }
   const urls=new Set();
   const sheet=document.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
   if(sheet)urls.add(sheet.href);
   for(const item of performance.getEntriesByType('resource')){
    if(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(item.name))urls.add(item.name);
   }
   if(urls.size)registration.active.postMessage({type:'PREPARE_FONTS',urls:[...urls]});
  }catch{/* Font caching is optional; the whole text still works offline. */}
 }
 async function checkForUpdates(){
  if(!registration||!navigator.onLine||Date.now()-lastChecked<60000)return;
  lastChecked=Date.now();
  try{await registration.update()}catch{/* Offline is fine. */}
 }
 navigator.serviceWorker.addEventListener('message',(event)=>{
  if(event.data?.type==='BOOK_UPDATED')announceUpdate();
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  checkOffline();
  if(previousController)announceUpdate();
  previousController=true;
  prepareFonts();
 });
 navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'})
  .then(async reg=>{
   registration=reg;await navigator.serviceWorker.ready;
   await checkOffline();await checkForUpdates();prepareFonts();
  })
  .catch(()=>setStatus('Offline setup failed','Open this page while online to retry.'));
 window.addEventListener('online',()=>{checkForUpdates();prepareFonts()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkOffline();checkForUpdates()}});
})();
