/* 11AM Politics — self-building accessible contents drawer.
   Reads the original course headings; never rewrites study text or print pages. */
(function(){
  'use strict';
  const KEY='11am-politics:last-reading';
  const get=id=>document.getElementById(id);
  const panel=get('politicsNavPanel');
  const trigger=get('politicsNavFab');
  const backdrop=get('politicsNavBackdrop');
  const closeButton=get('politicsNavClose');
  const tree=get('politicsNavTree');
  const input=get('politicsNavSearch');
  const status=get('politicsNavStatus');
  const results=get('politicsNavResults');
  const resume=get('politicsNavResume');
  const readingLabel=get('politicsReadingLabel');
  const readingFill=get('politicsReadingFill');
  if(!panel||!trigger||!tree||!input)return;

  const groups=[];
  const chapters=[];
  const chapterLinks=new Map();
  const targetLinks=new Map();
  const byTarget=new Map();
  let selectedId='';
  let isOpen=false;
  let restoreFocus=null;
  let scheduled=false;
  let lastSavedId='';

  function create(tag,className,text){
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(text!==undefined)e.textContent=text;
    return e;
  }
  function fold(s){
    return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .toLocaleLowerCase().replace(/\s+/g,' ').trim();
  }
  function openGroup(g,open,remember){
    g.element.classList.toggle('expanded',open);
    g.button.setAttribute('aria-expanded',String(open));
    g.children.hidden=!open;
    if(remember!==false)g.manualOpen=open;
  }
  function openChapter(ch,open,remember){
    ch.element.classList.toggle('expanded',open);
    ch.button.setAttribute('aria-expanded',String(open));
    ch.children.hidden=!open;
    if(remember!==false)ch.manualOpen=open;
  }
  function makeLink(id,label,className){
    const a=create('a',className,label);
    a.href='#'+id;
    a.dataset.targetId=id;
    targetLinks.set(id,a);
    return a;
  }

  function collect(){
    document.querySelectorAll('section.chapter[id]').forEach((section,i)=>{
      const h1=section.querySelector('.chapter-tab h1');
      const kicker=section.querySelector('.chapter-tab .kicker');
      const label=kicker?kicker.textContent.split('·').slice(1).join('·').trim():'Chapters';
      const chapter={
        id:section.id,element:null,button:null,children:null,link:null,
        section:section,number:String(i+1).padStart(2,'0'),
        title:h1?h1.textContent.trim():section.id,
        group:label||'Chapters',
        sections:[...section.querySelectorAll('.content h2[id]')],
        revisions:[...section.querySelectorAll('.end-matter .em-title[id]')],
        manualOpen:false,
        color:'hsl('+(section.style.getPropertyValue('--h').trim()||'200')+' 55% 38%)'
      };
      chapters.push(chapter);
    });
  }

  function build(){
    const intro=create('div','p-nav-frontmatter');
    intro.appendChild(makeLink('book-cover','Cover','p-nav-cover'));
    intro.appendChild(makeLink('book-contents','Printed contents','p-nav-printed'));
    tree.appendChild(intro);

    chapters.forEach(ch=>{
      let g=groups.find(x=>x.name===ch.group);
      if(!g){
        const outer=create('section','p-nav-group');
        const heading=create('button','p-nav-group-head');
        heading.type='button';
        const chev=create('span','p-nav-chevron','▸');
        chev.setAttribute('aria-hidden','true');
        const label=create('span','p-nav-group-name',ch.group);
        const count=create('span','p-nav-group-count');
        heading.append(chev,label,count);
        const children=create('div','p-nav-group-children');
        children.id='politics-nav-group-'+groups.length;
        heading.setAttribute('aria-controls',children.id);
        outer.append(heading,children);
        g={name:ch.group,element:outer,button:heading,children,chapters:[],manualOpen:false};
        groups.push(g);
        heading.addEventListener('click',()=>{
          if(input.value.trim())clearSearch();
          openGroup(g,!g.element.classList.contains('expanded'),true);
        });
        tree.appendChild(outer);
      }
      g.chapters.push(ch);
      ch.parent=g;
      const outer=create('div','p-nav-chapter');
      outer.style.setProperty('--chapter-color',ch.color);
      const row=create('div','p-nav-chapter-row');
      const a=makeLink(ch.id,'','p-nav-chapter-link');
      const num=create('span','p-nav-chapter-num',ch.number);
      const title=create('span','p-nav-chapter-title',ch.title);
      a.append(num,title);
      const toggle=create('button','p-nav-chapter-toggle');
      toggle.type='button';
      toggle.appendChild(create('span','p-nav-chevron','▸'));
      toggle.setAttribute('aria-label','Show sections for chapter '+ch.number+': '+ch.title);
      toggle.title='Expand or collapse chapter sections';
      const children=create('div','p-nav-chapter-children');
      children.id='politics-nav-sections-'+ch.number;
      toggle.setAttribute('aria-controls',children.id);
      row.append(a,toggle);outer.append(row,children);
      ch.element=outer;ch.button=toggle;ch.children=children;ch.link=a;
      chapterLinks.set(ch.id,a);
      byTarget.set(ch.id,ch);

      ch.sections.forEach(heading=>{
        const link=makeLink(heading.id,heading.textContent.trim().replace(/\s+/g,' '),
          'p-nav-entry p-nav-entry-section');
        children.appendChild(link);byTarget.set(heading.id,ch);
      });
      if(ch.revisions.length){
        const label=create('div','p-nav-revision-label','REVISION & RECALL');
        children.appendChild(label);
        ch.revisions.forEach(heading=>{
          const link=makeLink(heading.id,heading.textContent.trim().replace(/\s+/g,' '),
            'p-nav-entry p-nav-revision');
          children.appendChild(link);byTarget.set(heading.id,ch);
        });
      }
      g.children.appendChild(outer);
      toggle.addEventListener('click',()=>{
        if(input.value.trim())clearSearch();
        const willOpen=!ch.element.classList.contains('expanded');
        if(willOpen)chapters.forEach(other=>{if(other!==ch)openChapter(other,false,true);});
        openChapter(ch,willOpen,true);
      });
      openChapter(ch,false,true);
    });
    groups.forEach((g,index)=>{
      g.button.querySelector('.p-nav-group-count').textContent=
        g.chapters[0].number+'–'+g.chapters[g.chapters.length-1].number;
      openGroup(g,index===0,true);
    });
    const finalLinks=create('div','p-nav-frontmatter p-nav-afterword');
    finalLinks.appendChild(makeLink('closing-note','Closing Note','p-nav-closing'));
    tree.appendChild(finalLinks);
  }

  function clearSearch(){
    input.value='';
    filter();
  }
  function filter(){
    const q=fold(input.value), searching=!!q;
    let shown=0;
    groups.forEach(g=>{
      const groupMatch=searching && fold(g.name).includes(q);
      let groupCount=0;
      g.chapters.forEach(ch=>{
        const chapterMatch=searching && (
          groupMatch||fold(ch.number+' '+ch.title+' chapter '+Number(ch.number)).includes(q)
        );
        let subMatches=0;
        ch.children.querySelectorAll('a.p-nav-entry').forEach(a=>{
          const matched=!searching||chapterMatch||fold(a.textContent).includes(q);
          a.hidden=!matched;
          if(searching&&matched&&!chapterMatch)subMatches++;
        });
        const visible=!searching||chapterMatch||subMatches>0;
        ch.element.hidden=!visible;
        if(visible){groupCount++;shown++;}
        if(searching)openChapter(ch,visible,false);
        else openChapter(ch,ch.manualOpen,false);
      });
      g.element.hidden=searching&&groupCount===0;
      if(searching)openGroup(g,groupCount>0,false);
      else openGroup(g,g.manualOpen,false);
    });
    results.textContent=searching
      ? shown+' of '+chapters.length+' chapters match'
      : chapters.length+' chapters · Search titles, sections and revision';
  }
  function expandAll(open){
    clearSearch();
    groups.forEach(g=>openGroup(g,open,true));
    chapters.forEach(ch=>openChapter(ch,open,true));
  }

  function focusables(){
    return [...panel.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )].filter(el=>!el.closest('[hidden],[inert]') && el.getClientRects().length);
  }
  function onKeys(e){
    if(e.key==='Escape'){e.preventDefault();close(true);return;}
    if(e.key!=='Tab')return;
    const nodes=focusables();
    if(!nodes.length){e.preventDefault();panel.focus();return;}
    const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel)){
      e.preventDefault();last.focus();
    } else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel)){
      e.preventDefault();first.focus();
    } else if(!panel.contains(document.activeElement)){
      e.preventDefault();first.focus();
    }
  }
  function open(){
    if(isOpen)return;
    restoreFocus=document.activeElement;
    isOpen=true;
    panel.inert=false;panel.setAttribute('aria-hidden','false');
    panel.classList.add('open');
    backdrop.hidden=false;
    trigger.classList.add('is-hidden');
    trigger.setAttribute('aria-expanded','true');
    document.body.classList.add('politics-nav-open');
    closeButton.focus();
    document.addEventListener('keydown',onKeys);
  }
  function close(returnFocus){
    if(!isOpen)return;
    isOpen=false;
    panel.classList.remove('open');
    panel.inert=true;panel.setAttribute('aria-hidden','true');
    backdrop.hidden=true;
    trigger.classList.remove('is-hidden');
    trigger.setAttribute('aria-expanded','false');
    document.body.classList.remove('politics-nav-open');
    document.removeEventListener('keydown',onKeys);
    if(returnFocus!==false&&restoreFocus&&restoreFocus.isConnected)restoreFocus.focus();
  }

  function lastReading(){
    try{
      const id=localStorage.getItem(KEY);
      return id&&byTarget.has(id)?id:'';
    }catch{return '';}
  }
  function refreshResume(){
    const id=lastReading();
    resume.hidden=!id;
    if(id){
      const ch=byTarget.get(id);
      resume.textContent='Resume reading · Ch. '+ch.number+' — '+ch.title;
    }
  }
  function savePosition(id){
    if(!id||id===lastSavedId||!byTarget.has(id))return;
    lastSavedId=id;
    try{localStorage.setItem(KEY,id);}catch{/* Browsers may disable storage. */}
    refreshResume();
  }
  function markActive(id){
    if(id===selectedId)return;
    const old=targetLinks.get(selectedId);
    if(old){old.classList.remove('active');old.removeAttribute('aria-current');}
    chapters.forEach(ch=>ch.element.classList.remove('has-active'));
    selectedId=id;
    if(!id)return;
    const ch=byTarget.get(id);
    if(!ch)return;
    const link=targetLinks.get(id)||ch.link;
    if(link){link.classList.add('active');link.setAttribute('aria-current','location');}
    ch.element.classList.add('has-active');
    const label='Ch. '+ch.number+' · '+ch.title;
    status.textContent='Now reading: '+label;
    readingLabel.textContent=label;
    readingFill.style.backgroundColor=ch.color;
    savePosition(id);
  }
  function updateReading(){
    scheduled=false;
    const scrollMax=document.documentElement.scrollHeight-window.innerHeight;
    const pct=scrollMax>0?Math.min(100,Math.max(0,100*window.scrollY/scrollMax)):0;
    readingFill.style.width=pct+'%';
    readingFill.setAttribute('aria-valuenow',String(Math.round(pct)));
    const line=window.innerHeight*.36;
    let ch=null;
    for(const candidate of chapters){
      if(candidate.section.getBoundingClientRect().top<=line)ch=candidate;
      else break;
    }
    if(!ch){
      const toc=get('book-contents');
      readingLabel.textContent=toc&&toc.getBoundingClientRect().top<=line
        ? 'Table of Contents':'Cover · Complete Study Guide';
      status.textContent='Explore 20 chapters and their revision material';
      markActive('');
      return;
    }
    let id=ch.id;
    for(const heading of [...ch.sections,...ch.revisions]){
      if(heading.getBoundingClientRect().top<=line)id=heading.id;
      else break;
    }
    markActive(id);
  }
  function requestUpdate(){
    if(!scheduled){scheduled=true;requestAnimationFrame(updateReading);}
  }
  function focusAnchor(target){
    if(!target)return;
    if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
    requestAnimationFrame(()=>target.focus({preventScroll:true}));
  }

  collect();build();filter();refreshResume();
  trigger.addEventListener('click',open);
  closeButton.addEventListener('click',()=>close(true));
  backdrop.addEventListener('click',()=>close(true));
  get('politicsNavExpandAll').addEventListener('click',()=>expandAll(true));
  get('politicsNavCollapseAll').addEventListener('click',()=>expandAll(false));
  input.addEventListener('input',filter);
  tree.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');
    if(!link)return;
    const target=get(decodeURIComponent(link.hash.slice(1)));
    close(false);
    if(target)focusAnchor(target);
  });
  resume.addEventListener('click',()=>{
    const id=lastReading(),target=id&&get(id);
    if(!target)return;
    close(false);
    if(location.hash==='#'+id)target.scrollIntoView({block:'start'});
    else location.hash=id;
    focusAnchor(target);
  });
  window.addEventListener('scroll',requestUpdate,{passive:true});
  window.addEventListener('resize',requestUpdate);
  window.addEventListener('hashchange',requestUpdate);
  window.addEventListener('load',requestUpdate);
  requestUpdate();
})();
