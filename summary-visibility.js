/* On-device visibility setting for the entire end-of-chapter study section.
 * The former summary-only setting is migrated so readers keep their choice.
 * Printed notes always include all original material.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.PoliticsSummaryVisibility=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const KEY='11am-politics:show-end-of-chapter-material-v2';
  const LEGACY_KEY='11am-politics:show-chapter-summaries-v1';
  const isRevisionAnchor=id=>/^ch(?:0[1-9]|1[0-9]|20)-rev[0-9]{2,3}$/.test(id||'');
  function read(storage){
    try{
      const current=storage.getItem(KEY);
      if(current!==null)return current!=='false';
      const previous=storage.getItem(LEGACY_KEY);
      if(previous===null)return true;
      const show=previous!=='false';
      // A reader who hid summaries previously now hides all end-matter.
      try{
        storage.setItem(KEY,show?'true':'false');
        storage.removeItem(LEGACY_KEY);
      }catch{/* Retain the choice even when migration writes are blocked. */}
      return show;
    }catch{return true;}
  }
  function write(storage,show){
    try{storage.setItem(KEY,show?'true':'false');return true;}
    catch{return false;}
  }
  return Object.freeze({KEY,LEGACY_KEY,isRevisionAnchor,read,write});
});
