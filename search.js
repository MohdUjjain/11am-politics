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
  if(typeof document==='undefined')return Object.freeze({squish,fold,matches,excerpt});

  const get=id=>document.getElementById(id);
  const input=get('politicsFullSearch');
  const popup=get('politicsSearchPopover');
  const results=get('politicsSearchResults');
  const meta=get('politicsSearchMeta');
  const closeButton=get('politicsSearchClose');
  if(!input||!popup||!results||!meta||!closeButton)return Object.freeze({squish,fold,matches,excerpt});

  let records=null,visible=[],selected=null,debounce=null;
  const MAX_VISIBLE=65;
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

  function show(){
    popup.hidden=false;
    input.setAttribute('aria-expanded','true');
  }
  function hide(){
    popup.hidden=true;
    input.setAttribute('aria-expanded','false');
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
  function selectResult(record){
    hide();
    const el=record.element;
    if(selected)selected.classList.remove('p-search-hit');
    selected=el;
    const revision=el.closest('.end-matter');
    if(revision&&document.body.classList.contains('politics-hide-chapter-summaries')){
      revision.classList.add('politics-explicit-revision');
    }
    if(record.anchor){
      const newHash='#'+record.anchor;
      if(location.hash!==newHash)location.hash=newHash;
      else window.dispatchEvent(new Event('hashchange'));
    }
    requestAnimationFrame(()=>{
      el.scrollIntoView({block:'center',behavior:'instant'});
      el.classList.add('p-search-hit');
      if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');
      el.focus({preventScroll:true});
    });
  }
  function render(){
    if(document.body.classList.contains('politics-nav-open')){
      hide();return;
    }
    const query=squish(input.value);
    results.replaceChildren();
    visible=[];
    if(!query){hide();meta.textContent='Search the complete notes';return;}
    const all=buildIndex();
    const matched=[];
    for(const r of all){
      if(matches(r.searchText,query))matched.push(r);
    }
    matched.sort((a,b)=>{
      // Prefer phrase hits, but preserve reading order within the same rank.
      const q=fold(query);
      const rank=r=>r.searchText.includes(q)?2:1;
      return rank(b)-rank(a);
    });
    visible=matched.slice(0,MAX_VISIBLE);
    const total=matched.length;
    meta.textContent=total
      ?total+' matching passages'+(total>MAX_VISIBLE?' · first '+MAX_VISIBLE+' shown':'')
      :'No matching passages';
    if(!total){
      results.appendChild(make('p','p-search-empty','Try another word or phrase.'));
    }
    for(const record of visible){
      const button=make('button','p-search-result');
      button.type='button';
      const locationLabel=(record.chapter?'Ch. '+record.chapter+' · ':'')+
        record.chapterTitle;
      button.appendChild(make('span','p-search-result-heading',locationLabel));
      if(record.sectionTitle!==record.chapterTitle){
        button.appendChild(make('span','p-search-result-section',record.sectionTitle));
      }
      const preview=make('span','p-search-result-snippet');
      addSnippet(preview,record.text,query);
      button.appendChild(preview);
      button.addEventListener('click',()=>selectResult(record));
      button.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();
          const buttons=[...results.querySelectorAll('.p-search-result')];
          const index=buttons.indexOf(button);
          const next=(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
          buttons[next]?.focus();
        }else if(event.key==='Escape'){
          event.preventDefault();hide();input.focus();
        }
      });
      results.appendChild(button);
    }
    show();
  }
  input.addEventListener('input',()=>{
    if(debounce)clearTimeout(debounce);
    debounce=setTimeout(render,90);
  });
  input.addEventListener('focus',()=>{if(input.value.trim())render();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();hide();input.blur();}
    if(event.key==='ArrowDown'&& !popup.hidden){
      event.preventDefault();
      results.querySelector('.p-search-result')?.focus();
    }
    if(event.key==='Enter'){
      event.preventDefault();
      if(popup.hidden)render();
      results.querySelector('.p-search-result')?.click();
    }
  });
  closeButton.addEventListener('click',()=>hide());
  document.addEventListener('pointerdown',event=>{
    if(!popup.hidden && !popup.contains(event.target)&&
       !input.contains(event.target))hide();
  });
  window.addEventListener('politics:drawer-open',()=>{
    if(debounce)clearTimeout(debounce);
    hide();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&
      !document.activeElement?.isContentEditable){
      event.preventDefault();input.focus();input.select();
    }
  });
  return Object.freeze({squish,fold,matches,excerpt,buildIndex});
});
