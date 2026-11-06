/* 11AM Politics — all-notes search in the sticky reading header.
   Searches the actual DOM of the book, including paragraphs, tables,
   callouts, headings and revision material. No service or network queries. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.PoliticsFullTextSearch=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const squish=s=>String(s||'').replace(/\s+/g,' ').trim();
  const fold=s=>squish(s).normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  function matches(text,query){
    const q=fold(query);
    if(!q)return false;
    const t=fold(text);
    return q.split(' ').every(token=>t.includes(token));
  }
  function excerpt(text,query,size=185){
    const t=squish(text),q=fold(query);
    if(!q)return t.slice(0,size);
    const folded=fold(t);
    let i=folded.indexOf(q);
    if(i<0)i=folded.indexOf(q.split(' ')[0]);
    if(i<0)i=0;
    let start=Math.max(0,i-56),end=Math.min(t.length,Math.max(i+q.length+70,start+size));
    if(end-start>size+75)end=start+size+75;
    const snippet=t.slice(start,end);
    return (start?'…':'')+snippet+(end<t.length?'…':'');
  }
  // Unicode-aware match offsets so a search for "democracy" can also
  // highlight a diacritic variant without moving the original text nodes.
  function matchOffsets(text,query,max=48){
    const tokens=[...new Set(fold(query).split(' ').filter(Boolean))];
    if(!tokens.length)return [];
    let normalized='',starts=[],ends=[];
    for(let i=0;i<text.length;){
      const glyph=String.fromCodePoint(text.codePointAt(i));
      const simple=glyph.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
      for(let j=0;j<simple.length;j++){
        starts.push(i);ends.push(i+glyph.length);
      }
      normalized+=simple;
      i+=glyph.length;
    }
    const hits=[];
    for(const token of tokens){
      let at=0;
      while(hits.length<max && (at=normalized.indexOf(token,at))!==-1){
        hits.push([starts[at],ends[at+token.length-1]]);
        at+=Math.max(1,token.length);
      }
      if(hits.length>=max)break;
    }
    hits.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    // Remove overlapping ranges: DOM marks must not be nested or malformed.
    const disjoint=[];
    for(const hit of hits){
      if(!disjoint.length||hit[0]>=disjoint[disjoint.length-1][1])
        disjoint.push(hit);
    }
    return disjoint;
  }
  if(typeof document==='undefined')return Object.freeze({squish,fold,matches,excerpt,matchOffsets});

  const get=id=>document.getElementById(id);
  const input=get('politicsFullSearch');
  const popup=get('politicsSearchPopover');
  const results=get('politicsSearchResults');
  const meta=get('politicsSearchMeta');
  const closeButton=get('politicsSearchClose');
  const moreButton=get('politicsSearchMore');
  if(!input||!popup||!results||!meta||!closeButton||!moreButton)
    return Object.freeze({squish,fold,matches,excerpt});

  let records=null,selected=null,debounce=null,searchRevision=0;
  let matchesForQuery=[],shown=0,previousMarks=[],activeIndex=-1;
  let suppressFocusRender=false;
  function restoreInputFocus(){
    suppressFocusRender=true;
    input.focus({preventScroll:true});
    suppressFocusRender=false;
  }
  const PAGE_SIZE=35;
  const HIGHLIGHT_NAME='politics-search-term';
  function make(tag,className,value){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(value!==undefined)el.textContent=value;
    return el;
  }
  function buildIndex(){
    if(records)return records;
    records=[];
    // Text nodes rather than a list of heading types: every word in
    // paragraphs, nested emphasis, tables, cards, side notes, definitions,
    // mnemonic boxes and revision sections belongs to the searchable corpus.
    const locator='p,li,td,th,h1,h2,h3,h4,h5,caption,.em-title,'+
      '.box-label,.ch-subtitle,.ch-quote,.kicker,.lead,.step,'+
      '.flow-note,.mc-item,.legend-item,.in-this-chapter,.rs-block';
    const containers=[...document.querySelectorAll('section.chapter')];
    const closing=get('closing-note');
    const legend=document.querySelector('.legend-page');
    if(legend)containers.unshift(legend);
    if(closing)containers.push(closing.closest('section')||closing);
    for(const container of containers){
      const chapter=container.classList.contains('chapter')?container:null;
      const chId=chapter?.id||'';
      const chNum=chId?chId.slice(2):'';
      const chTitle=chapter?.querySelector('.chapter-tab h1')?.textContent?.trim()||
        (container===legend?'Using this guide':'Closing Note');
      let anchor=chId||((container===legend)?'book-cover':'closing-note');
      let sectionTitle=chTitle;
      const byElement=new Map();
      const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(!node.nodeValue?.trim())continue;
        const parent=node.parentElement;
        if(!parent||parent.closest('script,style,noscript'))continue;
        const heading=parent.closest('.content h2[id],.end-matter .em-title[id]');
        if(heading&&heading.id!==anchor){
          anchor=heading.id;
          sectionTitle=squish(heading.textContent);
        }
        const element=parent.closest(locator)||parent;
        let r=byElement.get(element);
        if(!r){
          r={element,chapter:chNum,chapterTitle:chTitle,
            sectionTitle,anchor,text:'',searchText:''};
          byElement.set(element,r);
          records.push(r);
        }
        r.text+=node.nodeValue;
      }
    }
    records=records.filter(r=>{
      r.text=squish(r.text);
      r.searchText=fold(r.text);
      return r.text.length>1;
    });
    return records;
  }

  function cancelPending(){
    searchRevision++;
    if(debounce!==null){clearTimeout(debounce);debounce=null;}
  }
  function show(){
    popup.hidden=false;
    input.setAttribute('aria-expanded','true');
  }
  function hide(){
    cancelPending();
    popup.hidden=true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    activeIndex=-1;
  }
  function setActive(index){
    const options=[...results.querySelectorAll('[role="option"]')];
    const previous=options[activeIndex];
    if(previous){
      previous.setAttribute('aria-selected','false');
      previous.classList.remove('p-search-option-active');
    }
    if(index<0||index>=options.length){
      activeIndex=-1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    activeIndex=index;
    const option=options[index];
    option.setAttribute('aria-selected','true');
    option.classList.add('p-search-option-active');
    input.setAttribute('aria-activedescendant',option.id);
    option.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function clearHighlights(){
    if(window.CSS?.highlights)CSS.highlights.delete(HIGHLIGHT_NAME);
    for(const mark of previousMarks){
      if(!mark.isConnected)continue;
      const parent=mark.parentNode;
      while(mark.firstChild)parent.insertBefore(mark.firstChild,mark);
      mark.remove();
      parent.normalize();
    }
    previousMarks=[];
    if(selected)selected.classList.remove('p-search-hit');
    selected=null;
  }
  function highlightPassage(element,query){
    clearHighlights();
    selected=element;
    element.classList.add('p-search-hit');
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    const ranges=[],fallback=[];
    let node;
    while((node=walker.nextNode())){
      if(!node.nodeValue?.trim()||node.parentElement?.closest('script,style'))continue;
      const hits=matchOffsets(node.nodeValue,query);
      if(!hits.length)continue;
      for(const [start,end] of hits){
        const range=document.createRange();
        range.setStart(node,start);
        range.setEnd(node,end);
        ranges.push(range);
      }
      fallback.push({node,hits});
    }
    if(window.CSS?.highlights && typeof Highlight==='function'){
      CSS.highlights.set(HIGHLIGHT_NAME,new Highlight(...ranges));
      return;
    }
    // Fallback for browsers without CSS Custom Highlight API. Work backwards
    // within each text node so splitting doesn't invalidate earlier offsets.
    for(const {node,hits} of fallback){
      for(const [start,end] of [...hits].reverse()){
        node.splitText(end);
        const middle=node.splitText(start);
        const mark=document.createElement('mark');
        mark.className='p-search-term';
        middle.parentNode.insertBefore(mark,middle);
        mark.appendChild(middle);
        previousMarks.push(mark);
      }
    }
  }
  function addSnippet(parent,text,query){
    const t=excerpt(text,query);
    const q=squish(query).toLocaleLowerCase();
    const at=t.toLocaleLowerCase().indexOf(q);
    if(at>=0&&q){
      parent.append(document.createTextNode(t.slice(0,at)));
      parent.appendChild(make('mark','',t.slice(at,at+q.length)));
      parent.append(document.createTextNode(t.slice(at+q.length)));
    }else{
      parent.textContent=t;
    }
  }
  function excludedByRevisionSetting(record){
    return document.body.classList.contains('politics-hide-study-material') &&
      !!record.element.closest('.end-matter');
  }
  function selectResult(record){
    // A preexisting/stale result must never override an explicit Hide setting.
    if(excludedByRevisionSetting(record)){render();return;}
    hide(); // cancels queued typing callbacks before any navigation
    const el=record.element;
    const query=input.value;
    if(record.anchor){
      const newHash='#'+record.anchor;
      if(location.hash!==newHash)location.hash=newHash;
      else window.dispatchEvent(new Event('hashchange'));
    }
    requestAnimationFrame(()=>{
      el.scrollIntoView({block:'center',behavior:'instant'});
      highlightPassage(el,query);
      if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');
      el.focus({preventScroll:true});
    });
  }
  function appendNextPage(){
    // An incremental results list has no 65-result ceiling. A button provides
    // deliberate access to the complete corpus in manageable batches.
    const query=squish(input.value);
    const limit=Math.min(matchesForQuery.length,shown+PAGE_SIZE);
    const fragment=document.createDocumentFragment();
    for(let i=shown;i<limit;i++){
      const record=matchesForQuery[i];
      const button=make('button','p-search-result');
      button.type='button';
      button.id='politics-search-result-'+i;
      button.setAttribute('role','option');
      button.setAttribute('aria-selected','false');
      button.tabIndex=-1;
      const locationLabel=(record.chapter?'Ch. '+record.chapter+' · ':'')+
        record.chapterTitle;
      button.appendChild(make('span','p-search-result-heading',locationLabel));
      if(record.sectionTitle!==record.chapterTitle)
        button.appendChild(make('span','p-search-result-section',record.sectionTitle));
      const preview=make('span','p-search-result-snippet');
      addSnippet(preview,record.text,query);
      button.appendChild(preview);
      button.addEventListener('click',()=>selectResult(record));
      button.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();
          restoreInputFocus();
          setActive(i+(event.key==='ArrowDown'?1:-1));
        }else if(event.key==='Escape'){
          event.preventDefault();hide();restoreInputFocus();
        }
      });
      fragment.appendChild(button);
    }
    results.appendChild(fragment);
    shown=limit;
    moreButton.hidden=shown>=matchesForQuery.length;
    if(!moreButton.hidden)
      moreButton.textContent='Show more results · '+shown+' of '+matchesForQuery.length;
    meta.textContent=matchesForQuery.length
      ?'Showing '+shown+' of '+matchesForQuery.length+' matching passages'
      :'No matching passages';
  }
  function render(){
    if(document.body.classList.contains('politics-nav-open')){
      hide();return;
    }
    const query=squish(input.value);
    results.replaceChildren();
    moreButton.hidden=true;
    matchesForQuery=[];
    shown=0;
    setActive(-1);
    if(!query){hide();meta.textContent='Search the complete notes';return;}
    for(const record of buildIndex()){
      if(!excludedByRevisionSetting(record) && matches(record.searchText,query))
        matchesForQuery.push(record);
    }
    // Prefer exact phrase hits while keeping the book order for ties.
    matchesForQuery.sort((a,b)=>{
      const q=fold(query);
      return Number(b.searchText.includes(q))-Number(a.searchText.includes(q));
    });
    if(!matchesForQuery.length){
      results.appendChild(make('p','p-search-empty','Try another word or phrase.'));
    }else{
      appendNextPage();
    }
    meta.textContent=matchesForQuery.length
      ?'Showing '+shown+' of '+matchesForQuery.length+' matching passages'
      :'No matching passages';
    show();
  }
  get('politicsShowStudyMaterial')?.addEventListener('change',()=>{
    if(input.value.trim())render();
  });
  input.addEventListener('input',()=>{
    cancelPending();
    clearHighlights();
    const revision=searchRevision;
    debounce=setTimeout(()=>{
      debounce=null;
      if(revision===searchRevision)render();
    },90);
  });
  input.addEventListener('focus',()=>{
    if(!suppressFocusRender&&input.value.trim()&&popup.hidden)render();
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();hide();return; // Keep keyboard focus in search.
    }
    if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();
      if(popup.hidden)render();
      if(!matchesForQuery.length)return;
      if(event.key==='ArrowDown'&&activeIndex===shown-1&&shown<matchesForQuery.length)
        appendNextPage();
      const next=event.key==='ArrowDown'
        ?(activeIndex+1)%shown:(activeIndex<1?shown-1:activeIndex-1);
      setActive(next);
    }
    if(!popup.hidden&&(event.key==='Home'||event.key==='End')){
      event.preventDefault();
      setActive(event.key==='Home'?0:shown-1);
    }
    if(event.key==='Enter'){
      event.preventDefault();
      if(popup.hidden)render();
      const options=results.querySelectorAll('[role="option"]');
      options[activeIndex<0?0:activeIndex]?.click();
    }
  });
  moreButton.addEventListener('click',()=>{
    const firstNew=shown;
    appendNextPage();
    restoreInputFocus();
    setActive(firstNew);
  });
  closeButton.addEventListener('click',()=>{hide();restoreInputFocus();});
  document.addEventListener('pointerdown',event=>{
    if(!popup.hidden && !popup.contains(event.target)&&
       !input.contains(event.target))hide();
  });
  window.addEventListener('politics:drawer-open',hide);
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('politics-nav-open')&&
      event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&
      !document.activeElement?.isContentEditable){
      event.preventDefault();input.focus();input.select();
    }
  });
  return Object.freeze({squish,fold,matches,excerpt,matchOffsets,buildIndex});
});
