/* 11AM Politics — offline status, installed edition and update control.
   The active service worker is the source of truth for the cached edition.
   Storage and reading preferences are not touched by an update. */
(()=>{
 'use strict';
 const get=id=>document.getElementById(id);
 const toggle=get('offlineToggle');
 const details=get('offlineDetails');
 const message=get('offlineMessage');
 const keep=get('offlineKeep');
 const install=get('offlineInstall');
 const reload=get('offlineReload');
 const edition=get('politicsEditionVersion');
 const editionStatus=get('politicsEditionStatus');
 const checkButton=get('politicsCheckUpdates');
 const editionReload=get('politicsEditionReload');
 const CACHE_PREFIX='11am-politics-reader-';
 // Exactly the executable offline reader, never auxiliary imagery/metadata.
 const ESSENTIALS=['./index.html','./manifest.webmanifest','./assets/js/offline.js',
  './assets/js/reading-position.js','./assets/js/study-material-visibility.js','./assets/js/navigation.js',
  './assets/js/search.js','./assets/css/navigation.css'];
 let installPrompt=null,registration=null,updated=false,ready=false;
 let checkInFlight=null,lastChecked=0;
 let previousController=!!navigator.serviceWorker?.controller;
 const supportsWorkers='serviceWorker' in navigator && 'caches' in window;

 function status(text){if(editionStatus)editionStatus.textContent=text;}
 function indicator(label,description,kind){
  toggle.textContent=kind==='ready'?'✓':kind==='update'?'↻':label;
  toggle.classList.toggle('is-ready',kind==='ready');
  toggle.classList.toggle('has-update',kind==='update');
  toggle.setAttribute('aria-label',description+'; open offline controls');
  toggle.title=description;
 }
 function setStatus(label,explanation,kind){
  if(!updated)indicator(label,explanation,kind);
  message.textContent=explanation;
 }
 function announceUpdate(){
  updated=true;
  indicator('↻','New edition ready. Reload to use it','update');
  reload.hidden=false;
  if(editionReload)editionReload.hidden=false;
  message.textContent='A newer edition was saved. Reload to read it. Your reading position and settings are retained.';
  status('New edition saved. Reload to use its updated notes and interface.');
  // Coordinate with the visible notice surface without coupling PWA state to
  // the reader controller's initialization order. Toolbar controls remain.
  window.__politicsEditionReady=true;
  window.dispatchEvent(new CustomEvent('politics:edition-notice',{
    detail:{available:true}
  }));
  refreshEdition();
 }
 function reloadBook(){location.reload();}
 reload.addEventListener('click',reloadBook);
 editionReload?.addEventListener('click',reloadBook);
 toggle.addEventListener('click',()=>{
  details.hidden=!details.hidden;
  toggle.setAttribute('aria-expanded',String(!details.hidden));
  if(!details.hidden)checkOffline();
 });
 window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();installPrompt=e;install.hidden=false;
 });
 window.addEventListener('appinstalled',()=>{install.hidden=true;installPrompt=null;});
 install.addEventListener('click',async()=>{
  if(!installPrompt)return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt=null;install.hidden=true;
 });
 keep.addEventListener('click',async()=>{
  keep.disabled=true;
  try{
   const granted=!!(navigator.storage?.persist&&await navigator.storage.persist());
   await checkOffline();
   if(!granted)message.textContent=
    'Saved offline, but persistent storage was not granted. Device cleanup may remove it.';
  }catch{
   message.textContent='Persistent storage is not available here; offline reading still works.';
   keep.disabled=false;
  }
 });

 // Workers report the version of their own active complete-book cache. This
 // remains available offline; no fetch of a version file or new edition is needed.
 function readWorkerEdition(worker){
  if(!worker||typeof MessageChannel==='undefined')return Promise.resolve('');
  return new Promise(resolve=>{
   const channel=new MessageChannel();
   let settled=false;
   const finish=value=>{
    if(settled)return;
    settled=true;clearTimeout(timer);
    channel.port1.close();resolve(value);
   };
   const timer=setTimeout(()=>finish(''),1400);
   channel.port1.onmessage=e=>{
    const data=e.data;
    finish(data?.type==='EDITION_STATUS'&&typeof data.revision==='string'
      ?data.revision:'');
   };
   try{worker.postMessage({type:'GET_EDITION'},[channel.port2]);}
   catch{finish('');}
  });
 }
 async function refreshEdition(){
  if(!edition)return;
  try{
   const worker=navigator.serviceWorker?.controller||registration?.active;
   let revision=await readWorkerEdition(worker);
   if(!revision){
    // Graceful fallback when an older edition does not support GET_EDITION.
    const keys=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX));
    if(keys.length)revision=keys[keys.length-1].slice(CACHE_PREFIX.length);
   }
   edition.textContent=revision||'Not available';
  }catch{edition.textContent='Not available';}
 }
 async function checkOffline(){
  if(!supportsWorkers)return;
  try{
   const keys=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX));
   let available=false;
   for(const name of [...keys].reverse()){
    const cache=await caches.open(name);
    if((await Promise.all(ESSENTIALS.map(path=>cache.match(path)))).every(Boolean)){
     available=true;break;
    }
   }
   ready=available;
   const persistent=navigator.storage?.persisted
    ?await navigator.storage.persisted():false;
   keep.disabled=!available||!!persistent;
   keep.textContent=persistent?'Persistent storage enabled':'Keep on this device';
   if(available){
    setStatus('✓ Offline',persistent
     ?'All 20 chapters are saved with persistent browser storage.'
     :'All 20 chapters are saved for offline reading. You can request longer storage.',
     'ready');
   }else{
    setStatus('⏳ Saving…','Preparing the complete 20-chapter guide for offline reading.','saving');
   }
   if(!updated&&!checkInFlight)status(available
    ?'Saved for offline reading. Use Check for updates to compare with the published edition.'
    :'Preparing the offline edition.');
   await refreshEdition();
  }catch{
   setStatus('Offline status unavailable','Browser storage could not be checked.','error');
   if(!updated)status('Offline storage could not be checked.');
  }
 }

 async function prepareFonts(){
  if(!navigator.onLine||!registration?.active)return;
  try{
   if(document.fonts?.load){
    await Promise.allSettled([
     '400 16px "Fraunces"','600 16px "Fraunces"','700 16px "Fraunces"',
     '900 16px "Fraunces"','400 16px "Source Sans 3"',
     '700 16px "Source Sans 3"','400 14px "IBM Plex Mono"',
     '600 14px "IBM Plex Mono"'
    ].map(spec=>document.fonts.load(spec,'Politics Study Notes')));
   }
   const urls=new Set();
   const sheet=document.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
   if(sheet)urls.add(sheet.href);
   for(const item of performance.getEntriesByType('resource')){
    if(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(item.name))urls.add(item.name);
   }
   if(urls.size)registration.active.postMessage({type:'PREPARE_FONTS',urls:[...urls]});
  }catch{/* Fonts are optional; all chapter text remains available offline. */}
 }
 async function checkForUpdates(manual=false){
  if(!registration){
   if(manual)status('Offline reader is still starting. Try again shortly.');
   return;
  }
  if(!navigator.onLine){
   if(manual)status('You are offline. Connect to the internet to check for editions.');
   return;
  }
  if(checkInFlight)return checkInFlight;
  if(!manual&&Date.now()-lastChecked<60000)return;
  lastChecked=Date.now();
  checkButton.disabled=true;
  if(manual&&!updated)status('Checking the published edition…');
  checkInFlight=(async()=>{
   try{
    await registration.update();
    if(!updated){
     if(registration.installing||registration.waiting){
      status('A new edition is downloading. Your current edition remains available.');
     }else if(manual){
      status('No newer edition found at this check. Your saved edition is current.');
     }
    }
    await refreshEdition();
   }catch{
    if(manual)status('Could not complete the update check. Try again when connected.');
   }finally{
    checkButton.disabled=false;
    checkInFlight=null;
   }
  })();
  return checkInFlight;
 }
 checkButton?.addEventListener('click',()=>checkForUpdates(true));
 if(!supportsWorkers){
  indicator('Offline unavailable','This browser does not support offline caching','error');
  message.textContent='Offline app caching is not supported in this browser.';
  keep.hidden=true;
  checkButton.disabled=true;
  if(edition)edition.textContent='Not supported';
  status('Offline updates are not supported in this browser.');
  return;
 }
 navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type==='BOOK_UPDATED')announceUpdate();
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  checkOffline();
  if(previousController)announceUpdate();
  previousController=true;
  prepareFonts();
 });
 navigator.serviceWorker.register('./service-worker.js',{
  scope:'./',updateViaCache:'none'
 }).then(async reg=>{
  registration=reg;
  reg.addEventListener('updatefound',()=>{
   if(previousController&&!updated)
    status('Downloading an updated edition. The existing copy remains readable.');
  });
  await navigator.serviceWorker.ready;
  await checkOffline();
  await checkForUpdates(false);
  prepareFonts();
 }).catch(()=>{
  setStatus('Offline setup failed','Open the page while online to retry.','error');
  status('Offline registration failed. The online study guide is still readable.');
 });
 window.addEventListener('online',()=>{
  checkForUpdates(false);prepareFonts();
 });
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){checkOffline();checkForUpdates(false);}
 });
})();
