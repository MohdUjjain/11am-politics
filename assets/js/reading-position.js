/* Versioned, on-device reading checkpoint for 11AM Politics.
 * No network access, analytics, or service-worker dependencies.
 * Exposed both to a classic browser script and to Node's test runner.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.PoliticsReadingPosition=api;
  if(typeof module==='object' && module.exports)module.exports=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const KEY='11am-politics:reading-position-v2';
  const LEGACY_KEY='11am-politics:last-reading';
  const chapterPattern=/^ch(?:0[1-9]|1[0-9]|20)$/;
  const anchorPattern=/^ch(?:0[1-9]|1[0-9]|20)-(?:sec|rev)[0-9]{2,3}$/;
  const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
  const fraction=(point,start,end)=>
    end>start?clamp((point-start)/(end-start)):0;
  const coordinate=(start,end,ratio,readingOffset=0)=>
    Math.max(0,start+Math.max(0,end-start)*clamp(ratio)-Math.max(0,readingOffset));

  function normalize(value){
    if(!value||typeof value!=='object'||!chapterPattern.test(value.chapterId||''))return null;
    const chapterId=value.chapterId;
    const anchorId=(value.anchorId===chapterId||
      (anchorPattern.test(value.anchorId||'')&&value.anchorId.startsWith(chapterId+'-')))
      ? value.anchorId : chapterId;
    return {
      v:2,chapterId,anchorId,
      anchorFraction:clamp(value.anchorFraction),
      chapterFraction:clamp(value.chapterFraction),
      savedAt:Number.isFinite(value.savedAt)&&value.savedAt>0?value.savedAt:0
    };
  }

  function read(storage){
    try{
      const raw=storage.getItem(KEY);
      if(raw){
        const position=normalize(JSON.parse(raw));
        return position;
      }
      const legacy=storage.getItem(LEGACY_KEY);
      if(!legacy)return null;
      const chapterId=legacy.slice(0,4);
      if(!chapterPattern.test(chapterId))return null;
      const position=normalize({
        chapterId,anchorId:legacy,anchorFraction:0,chapterFraction:0,savedAt:Date.now()
      });
      if(!position)return null;
      storage.setItem(KEY,JSON.stringify(position));
      storage.removeItem(LEGACY_KEY);
      return position;
    }catch{return null}
  }

  function write(storage,position){
    const normalized=normalize(position);
    if(!normalized)return false;
    try{
      storage.setItem(KEY,JSON.stringify(normalized));
      return true;
    }catch{return false}
  }

  return Object.freeze({KEY,LEGACY_KEY,normalize,read,write,fraction,coordinate});
});
