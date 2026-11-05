/* On-device chapter-summary visibility preference for 11AM Politics.
 * The preference is independent from the PWA cache and reading checkpoint.
 * The printed book always retains every summary.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.PoliticsSummaryVisibility=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const KEY='11am-politics:show-chapter-summaries-v1';
  const isSummaryAnchor=id=>/^ch(?:0[1-9]|1[0-9]|20)-rev01$/.test(id||'');
  function read(storage){
    try{return storage.getItem(KEY)!=='false';}
    catch{return true;}
  }
  function write(storage,show){
    try{storage.setItem(KEY,show?'true':'false');return true;}
    catch{return false;}
  }
  return Object.freeze({KEY,isSummaryAnchor,read,write});
});
