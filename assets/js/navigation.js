/* 11AM Politics — self-building accessible contents drawer.
   Reads the original course headings; never rewrites study text or print pages. */
(function(){
  'use strict';
  const position=window.PoliticsReadingPosition;
  const studyMaterialVisibility=window.PoliticsStudyMaterialVisibility;
  if(!position||!studyMaterialVisibility){
    console.warn('Reading settings helper unavailable');
    return;
  }
  const get=id=>document.getElementById(id);
  const panel=get('politicsNavPanel');
  const trigger=get('politicsNavFab');
  const backdrop=get('politicsNavBackdrop');
  const closeButton=get('politicsNavClose');
  const tree=get('politicsNavTree');
  const tabIndex=get('politicsTabIndex');
  const tabTools=get('politicsTabTools');
  const indexPanel=get('politicsPanelIndex');
  const toolsPanel=get('politicsPanelTools');
  const printButton=get('politicsNavPrint');
  const studyMaterialToggle=get('politicsShowStudyMaterial');
  const status=get('politicsNavStatus');
  const resume=get('politicsNavResume');
  const readingLabel=get('politicsReadingLabel');
  const readingFill=get('politicsReadingFill');
  const chapterProgress=get('politicsChapterProgress');
  const chapterPercent=get('politicsChapterPercent');
  const compactChapter=get('politicsCompactChapter');
  const backgroundElements=[...document.body.children]
    .filter(el=>el!==panel&&el!==backdrop&&el.tagName!=='SCRIPT');
  const backgroundInertState=new Map();
  const continueCard=get('politicsContinuePrompt');
  const continueDescription=get('politicsContinueDescription');
  const resumeNote=get('politicsResumeNote');
  const continueButton=get('politicsContinueButton');
  const continueDismiss=get('politicsContinueDismiss');
  if(!panel||!trigger||!tree||!studyMaterialToggle||!tabIndex||!tabTools)return;

  const groups=[];
  const chapters=[];
  const targetLinks=new Map();
  const byTarget=new Map();
  let selectedId='';
  let isOpen=false;
  let restoreFocus=null;
  let scheduled=false;
  let lastStoredPosition=position.read(localStorage);
  let lastWriteAt=0;
  let lastWriteAnchor='';
  let lastWriteFraction=-1;
  let suspendCapture=false;
  let resumePromptDismissed=false;
  let showStudyMaterial=studyMaterialVisibility.read(localStorage);

  function create(tag,className,text){
    const e=document.createElement(tag);
    if(className)e.className=className;
    if(text!==undefined)e.textContent=text;
    return e;
  }
  function openGroup(g,open){
    g.element.classList.toggle('expanded',open);
    g.button.setAttribute('aria-expanded',String(open));
    g.children.hidden=!open;
  }
  function openChapter(ch,open){
    ch.element.classList.toggle('expanded',open);
    ch.button.setAttribute('aria-expanded',String(open));
    ch.button.setAttribute('aria-label',
      (open?'Collapse':'Expand')+' sections for chapter '+ch.number+': '+ch.title);
    ch.children.hidden=!open;
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
        color:'hsl('+(section.style.getPropertyValue('--h').trim()||'200')+' 55% 38%)'
      };
      chapters.push(chapter);
    });
  }

  function build(){
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
        g={name:ch.group,element:outer,button:heading,children,chapters:[]};
        groups.push(g);
        heading.addEventListener('click',()=>{
          openGroup(g,!g.element.classList.contains('expanded'));
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
        const willOpen=!ch.element.classList.contains('expanded');
        if(willOpen)chapters.forEach(other=>{if(other!==ch)openChapter(other,false);});
        openChapter(ch,willOpen);
      });
      openChapter(ch,false);
    });
    groups.forEach((g,index)=>{
      g.button.querySelector('.p-nav-group-count').textContent=
        g.chapters[0].number+'–'+g.chapters[g.chapters.length-1].number;
      openGroup(g,index===0);
    });
    const finalLinks=create('div','p-nav-frontmatter p-nav-afterword');
    finalLinks.appendChild(makeLink('closing-note','Closing Note','p-nav-closing'));
    tree.appendChild(finalLinks);
  }

  function filter(){
    groups.forEach(g=>{
      g.element.hidden=false;
      g.chapters.forEach(ch=>{
        ch.element.hidden=false;
        const linkedRevision=!!ch.section.querySelector('.end-matter.politics-explicit-revision');
        const hideRevision=!showStudyMaterial&&!linkedRevision;
        const revisionLabel=ch.children.querySelector('.p-nav-revision-label');
        if(revisionLabel)revisionLabel.hidden=hideRevision;
        ch.children.querySelectorAll('a.p-nav-entry').forEach(a=>{
          a.hidden=hideRevision&&studyMaterialVisibility.isRevisionAnchor(a.dataset.targetId);
        });
      });
    });
  }
  function expandAll(open){
    groups.forEach(g=>openGroup(g,open));
    chapters.forEach(ch=>openChapter(ch,open));
  }
  function switchTab(which,focus){
    const index=which!=='tools';
    tabIndex.setAttribute('aria-selected',String(index));
    tabTools.setAttribute('aria-selected',String(!index));
    tabIndex.tabIndex=index?0:-1;
    tabTools.tabIndex=index?-1:0;
    indexPanel.hidden=!index;
    toolsPanel.hidden=index;
    if(focus)(index?tabIndex:tabTools).focus();
  }
  function onTabKeys(e){
    const keys=['ArrowLeft','ArrowRight','Home','End'];
    if(!keys.includes(e.key))return;
    e.preventDefault();
    const onIndex=tabIndex.getAttribute('aria-selected')==='true';
    const next=e.key==='Home'?'index':e.key==='End'?'tools':
      onIndex?'tools':'index';
    switchTab(next,true);
  }

  function syncLinkedRevision(){
    document.querySelectorAll('.end-matter.politics-explicit-revision')
      .forEach(el=>el.classList.remove('politics-explicit-revision'));
    if(showStudyMaterial)return;
    let id='';
    try{id=decodeURIComponent(location.hash.slice(1));}
    catch{return;}
    if(!studyMaterialVisibility.isRevisionAnchor(id))return;
    const target=get(id);
    if(target)target.closest('.end-matter')?.classList.add('politics-explicit-revision');
  }
  function applyStudyMaterialView(show,remember){
    showStudyMaterial=!!show;
    studyMaterialToggle.checked=showStudyMaterial;
    // A manual click to hide must hide everything even when the URL
    // currently points into a revision section.
    if(remember){
      document.querySelectorAll('.end-matter.politics-explicit-revision')
        .forEach(el=>el.classList.remove('politics-explicit-revision'));
      studyMaterialVisibility.write(localStorage,showStudyMaterial);
    }else syncLinkedRevision();
    document.body.classList.toggle('politics-hide-study-material',!showStudyMaterial);
    filter();
    refreshResume();
    requestUpdate();
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
    // A focus trap alone cannot isolate a modal from screen-reader navigation.
    // Remember other components' existing inert states and restore them later.
    backgroundInertState.clear();
    for(const el of backgroundElements){
      backgroundInertState.set(el,el.inert);
      el.inert=true;
    }
    panel.classList.add('open');
    backdrop.hidden=false;
    trigger.classList.add('is-hidden');
    trigger.setAttribute('aria-expanded','true');
    document.body.classList.add('politics-nav-open');
    window.dispatchEvent(new Event('politics:drawer-open'));
    closeButton.focus();
    document.addEventListener('keydown',onKeys);
  }
  function close(returnFocus){
    if(!isOpen)return;
    isOpen=false;
    panel.classList.remove('open');
    panel.inert=true;panel.setAttribute('aria-hidden','true');
    for(const [el,wasInert] of backgroundInertState)
      if(el.isConnected)el.inert=wasInert;
    backgroundInertState.clear();
    backdrop.hidden=true;
    trigger.classList.remove('is-hidden');
    trigger.setAttribute('aria-expanded','false');
    document.body.classList.remove('politics-nav-open');
    document.removeEventListener('keydown',onKeys);
    if(returnFocus!==false){
      const target=restoreFocus?.isConnected&&!restoreFocus.inert
        ?restoreFocus:trigger;
      target?.focus({preventScroll:true});
    }
  }

  function savedCheckpoint(){
    const data=position.read(localStorage)||lastStoredPosition;
    if(!data)return null;
    const chapter=chapters.find(c=>c.id===data.chapterId);
    if(!chapter)return null;
    // An updated edition may have moved or removed an individual heading.
    // Missing headings fall back to the saved chapter fraction.
    const exists=byTarget.has(data.anchorId);
    const anchorId=exists?data.anchorId:chapter.id;
    // Hiding study material never silently discards the exact saved section.
    const hiddenRevision=!showStudyMaterial&&exists&&
      studyMaterialVisibility.isRevisionAnchor(anchorId)&&
      !get(anchorId)?.closest('.end-matter.politics-explicit-revision');
    return {...data,chapter,anchorId,hiddenRevision,missingAnchor:!exists};
  }
  function savedDescription(saved){
    const entry=get(saved.anchorId);
    const name=entry&&entry.id!==saved.chapterId
      ? entry.textContent.trim().replace(/\s+/g,' ').slice(0,75)
      : saved.chapter.title;
    return 'Chapter '+saved.chapter.number+' · '+name+
      ' · approximately '+Math.round(saved.chapterFraction*100)+'% through the chapter'+
      (saved.hiddenRevision?' · hidden study material will be revealed temporarily':'');
  }
  function refreshResume(){
    const saved=savedCheckpoint();
    resume.hidden=!saved;
    if(saved)resume.textContent='Continue · Ch. '+saved.chapter.number+
      ' ('+Math.round(saved.chapterFraction*100)+'%)';
    if(saved&&continueDescription)continueDescription.textContent=savedDescription(saved);
    if(resumeNote)resumeNote.hidden=!saved?.hiddenRevision;
  }
  function showContinuePrompt(){
    if(!continueCard||resumePromptDismissed||location.hash||
      window.scrollY>90)return;
    const saved=savedCheckpoint();
    if(!saved)return;
    refreshResume();
    continueCard.hidden=false;
  }
  function hideContinuePrompt(){
    if(continueCard)continueCard.hidden=true;
  }
  function metrics(ch,anchorId){
    const topOf=el=>el.getBoundingClientRect().top+window.scrollY;
    const chapterStart=topOf(ch.section);
    const following=chapters[Number(ch.number)]?.section;
    const chapterEnd=following?topOf(following):topOf(ch.section)+ch.section.offsetHeight;
    // Elements hidden on screen must not be used as position boundaries.
    const headingList=[ch.section,...ch.sections,...ch.revisions]
      .filter(el=>el.getClientRects().length>0);
    const anchor=headingList.find(el=>el.id===anchorId)||ch.section;
    const index=headingList.indexOf(anchor);
    const next=headingList[index+1];
    const anchorStart=topOf(anchor);
    const anchorEnd=next?topOf(next):chapterEnd;
    return {chapterStart,chapterEnd,anchorStart,anchorEnd};
  }
  function checkpoint(ch,anchorId,readingPoint){
    const m=metrics(ch,anchorId);
    return position.normalize({
      chapterId:ch.id,anchorId,
      anchorFraction:position.fraction(readingPoint,m.anchorStart,m.anchorEnd),
      chapterFraction:position.fraction(readingPoint,m.chapterStart,m.chapterEnd),
      savedAt:Date.now()
    });
  }
  function persistReading(force){
    if(suspendCapture||!selectedId)return;
    const chapter=byTarget.get(selectedId);
    if(!chapter)return;
    const now=Date.now();
    const at=window.scrollY+window.innerHeight*.36;
    const saved=checkpoint(chapter,selectedId,at);
    // Persist exact section changes immediately, otherwise throttle scroll writes.
    if(!force&&saved.anchorId===lastWriteAnchor&&
       now-lastWriteAt<1200&&
       Math.abs(saved.chapterFraction-lastWriteFraction)<.025)return;
    if(position.write(localStorage,saved)){
      lastStoredPosition=saved;
      lastWriteAt=now;
      lastWriteAnchor=saved.anchorId;
      lastWriteFraction=saved.chapterFraction;
      refreshResume();
    }
  }
  function continueReading(){
    const saved=savedCheckpoint();
    if(!saved)return;
    close(false);
    hideContinuePrompt();
    resumePromptDismissed=true;
    const ch=saved.chapter;
    const target=get(saved.anchorId);
    if(saved.hiddenRevision&&target){
      // Reveal only this chapter's review section for this continuation.
      // The Tools checkbox and its persisted preference remain unchanged.
      const revision=target.closest('.end-matter');
      if(revision)revision.classList.add('politics-explicit-revision');
      filter();
    }
    const m=metrics(ch,saved.anchorId);
    const focusOffset=window.innerHeight*.36;
    const useAnchor=!!target&&saved.anchorId!==ch.id;
    const desired=useAnchor
      ? position.coordinate(m.anchorStart,m.anchorEnd,saved.anchorFraction,focusOffset)
      : position.coordinate(m.chapterStart,m.chapterEnd,saved.chapterFraction,focusOffset);
    suspendCapture=true;
    // Browser-native hash navigation would lose the saved offset.
    // Change the shareable URL without triggering an automatic anchor jump.
    if(window.history&&history.replaceState){
      history.replaceState(null,'','#'+saved.anchorId);
    }
    const original=document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior='auto';
    window.scrollTo({top:desired,behavior:'instant'});
    requestAnimationFrame(()=>{
      document.documentElement.style.scrollBehavior=original;
      suspendCapture=false;
      requestUpdate();
      const section=get(saved.anchorId);
      if(section){
        if(!section.hasAttribute('tabindex'))section.setAttribute('tabindex','-1');
        section.focus({preventScroll:true});
      }
    });
  }
  function updateChapterProgress(ch){
    if(!chapterProgress||!chapterPercent)return;
    if(!ch){
      if(compactChapter)compactChapter.textContent='Guide';
      chapterProgress.style.setProperty('--p-chapter-angle','0%');
      chapterProgress.style.setProperty('--p-chapter-color','#C6C0B0');
      chapterProgress.setAttribute('aria-valuenow','0');
      chapterProgress.setAttribute('aria-valuetext','Not currently in a chapter');
      chapterPercent.textContent='—';
      return;
    }
    if(compactChapter)compactChapter.textContent='Ch. '+ch.number;
    const m=metrics(ch,ch.id);
    const readingPoint=window.scrollY+window.innerHeight*.36;
    const pct=Math.round(position.fraction(readingPoint,m.chapterStart,m.chapterEnd)*100);
    chapterProgress.style.setProperty('--p-chapter-angle',pct+'%');
    chapterProgress.style.setProperty('--p-chapter-color',ch.color);
    chapterProgress.setAttribute('aria-valuenow',String(pct));
    chapterProgress.setAttribute('aria-valuetext',
      'Chapter '+ch.number+': '+pct+' percent complete');
    chapterPercent.textContent=pct+'%';
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
      updateChapterProgress(null);
      return;
    }
    let id=ch.id;
    for(const heading of [...ch.sections,...ch.revisions]){
      // Hidden end-of-chapter headings have no usable reading geometry.
      if(!heading.getClientRects().length)continue;
      if(heading.getBoundingClientRect().top<=line)id=heading.id;
      else break;
    }
    markActive(id);
    updateChapterProgress(ch);
    persistReading(false);
    if(continueCard&&!continueCard.hidden)hideContinuePrompt();
  }
  function requestUpdate(){
    if(!scheduled){scheduled=true;requestAnimationFrame(updateReading);}
  }
  function focusAnchor(target){
    if(!target)return;
    if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
    requestAnimationFrame(()=>target.focus({preventScroll:true}));
  }

  collect();build();applyStudyMaterialView(showStudyMaterial,false);switchTab('index',false);
  trigger.addEventListener('click',open);
  closeButton.addEventListener('click',()=>close(true));
  backdrop.addEventListener('click',()=>close(true));
  get('politicsNavExpandAll').addEventListener('click',()=>expandAll(true));
  get('politicsNavCollapseAll').addEventListener('click',()=>expandAll(false));
  tabIndex.addEventListener('click',()=>switchTab('index',false));
  tabTools.addEventListener('click',()=>switchTab('tools',false));
  tabIndex.addEventListener('keydown',onTabKeys);
  tabTools.addEventListener('keydown',onTabKeys);
  printButton.addEventListener('click',()=>{
    close(true);
    requestAnimationFrame(()=>window.print());
  });
  studyMaterialToggle.addEventListener('change',()=>{
    // Save the current reading checkpoint before removing summary content.
    persistReading(true);
    applyStudyMaterialView(studyMaterialToggle.checked,true);
  });
  tree.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');
    if(!link)return;
    const target=get(decodeURIComponent(link.hash.slice(1)));
    close(false);
    if(target)focusAnchor(target);
  });
  resume.addEventListener('click',continueReading);
  if(continueButton)continueButton.addEventListener('click',continueReading);
  if(continueDismiss)continueDismiss.addEventListener('click',()=>{
    resumePromptDismissed=true;
    hideContinuePrompt();
  });
  // Keep the reader at the cover on a later visit until they choose Continue.
  window.addEventListener('load',()=>requestAnimationFrame(showContinuePrompt));
  window.addEventListener('pageshow',()=>requestAnimationFrame(showContinuePrompt));
  window.addEventListener('pagehide',()=>persistReading(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')persistReading(true);
  });
  window.addEventListener('scroll',requestUpdate,{passive:true});
  window.addEventListener('resize',requestUpdate);
  window.addEventListener('hashchange',()=>{
    // Explicit deep links reveal the requested revision section temporarily.
    syncLinkedRevision();
    filter();
    requestUpdate();
  });
  window.addEventListener('load',requestUpdate);
  requestUpdate();
})();
