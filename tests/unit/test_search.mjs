import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const search=require('../../assets/js/search.js');

assert.equal(search.fold('  DÉMOCRACY   AND  POWER  '),'democracy and power');
assert.equal(search.matches('The sovereignty of the state','sovereignty'),true);
assert.equal(search.matches('The constitutional separation of powers','separation powers'),true);
assert.equal(search.matches('Green politics and cosmopolitan ideas','green cosmopolitan'),true);
assert.equal(search.matches('Sovereignty alone','sovereignty democracy'),false);
assert.equal(search.matches('Something',''),false);
assert.ok(search.excerpt('Introduction to the political system of democratic nations','political').includes('political'));
assert.ok(search.excerpt('a'.repeat(80)+' sovereignty '+'b'.repeat(290),'sovereignty').includes('sovereignty'));
assert.ok(search.excerpt('Some longer passage','passage').includes('passage'));
assert.deepEqual(search.matchOffsets('Démocracy and sovereign power','democracy'),[[0,9]],
  'Accent-insensitive query must locate exact original text positions');
assert.deepEqual(search.matchOffsets('Power and state power','power'),[[0,5],[16,21]],
  'Every occurrence of a term in a passage should be highlighted');
assert.deepEqual(search.matchOffsets('Civil, Political and Social rights','political social'),
  [[7,16],[21,27]],'Multi-word query must highlight both terms');
assert.deepEqual(search.matchOffsets('some words',''),[]);

const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const nav=readFileSync(new URL('../../assets/js/navigation.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../../assets/css/navigation.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../../assets/js/search.js',import.meta.url),'utf8');
assert.match(html,/id="politicsFullSearch"/);
assert.match(html,/id="politicsSearchPopover"/);
assert.match(html,/id="politicsSearchResults"/);
assert.match(html,/id="politicsSearchMore"/);
assert.match(html,/role="combobox"/);
assert.match(html,/role="listbox"/);
assert.match(html,/aria-autocomplete="list"/);
assert.match(html,/id="politicsCompactChapter"/);
assert.match(html,/class="p-skip-link"/);
assert.match(html,/<main class="shell" id="politicsMainContent">/);
assert.ok(source.includes('aria-activedescendant')&&source.includes("role','option'"),
  'Search options are announced through an active-descendant combobox');
assert.ok(source.includes('restoreInputFocus()')&&!source.includes('input.blur()'),
  'Closing results must preserve keyboard search focus');
assert.ok(nav.includes('backgroundInertState.set')&&nav.includes('backgroundInertState.clear()'),
  'Modal background needs reversible inert handling');
assert.ok(nav.includes("compactChapter.textContent='Ch. '"),
  'Small-screen readers must retain chapter identity');
assert.ok(css.includes('safe-area-inset-top')&&css.includes('safe-area-inset-bottom'),
  'Fixed controls must respect display cutouts and home indicators');
assert.ok(css.includes('scroll-behavior:auto!important'),
  'Reduced-motion preference must disable smooth scrolling');
assert.match(html,/role="search"/);
assert.match(html,/id="politicsTabIndex" role="tab" aria-selected="true"/);
assert.match(html,/id="politicsTabTools" role="tab" aria-selected="false"/);
assert.match(html,/id="politicsPanelIndex" class="p-nav-tabpanel" role="tabpanel"/);
assert.match(html,/id="politicsPanelTools" class="p-nav-tabpanel p-nav-toolspanel" role="tabpanel"/);
assert.match(html,/id="politicsNavPrint"/);
assert.ok(!html.includes('id="politicsNavSearch"'),'Sidebar search removed');
assert.ok(!nav.includes("makeLink('book-cover'"),'Cover shortcut removed');
assert.ok(!nav.includes("makeLink('book-contents'"),'Printed Contents shortcut removed');
assert.ok(!nav.includes('politicsNavSearch'),'No stale sidebar search handlers');
assert.ok(nav.includes('window.print()'),'Print action opens browser print dialogue');
assert.ok(nav.includes("switchTab('tools'"),'Tools tab usable');
assert.ok(nav.includes("switchTab('index'"),'Index tab usable');
assert.ok(nav.includes("resume.addEventListener('click',continueReading)"),
  'Continue Reading remains accessible from both tabs');
assert.ok(source.includes("document.createTreeWalker(container,NodeFilter.SHOW_TEXT)"),
  'Search must index text nodes, not just headings');
assert.ok(source.includes("'section.chapter'")||source.includes("'section.chapter')"),
  'Search must index every chapter');
assert.ok(source.includes('function cancelPending()')&&source.includes('searchRevision'),
  'Pending searches must be invalidated on closing, selecting and new queries');
assert.ok(source.includes('const PAGE_SIZE=35')&&source.includes("get('politicsSearchMore')")&&
  source.includes('appendNextPage()'),
  'All results must be reachable through incremental paging');
assert.ok(!source.includes('MAX_VISIBLE=65'),'Old hard ceiling must be removed');
assert.ok(source.includes("CSS.highlights.set(HIGHLIGHT_NAME")&&
  source.includes("mark.className='p-search-term'"),
  'Term highlighting must work both with and without the browser API');
assert.ok(!nav.includes('readingFill.style.backgroundColor=ch.color'),
  'The book rail must not change with chapter hue');
assert.ok(css.includes('::highlight(politics-search-term)')&&
  css.includes('mark.p-search-term'),'Exact term highlighting must be styled');
assert.ok(source.includes("el.scrollIntoView({block:'center'"),
  'Search click must navigate to the matching passage');
assert.ok(source.includes('!excludedByRevisionSetting(record)'),
  'Search must exclude hidden end-of-chapter material at retrieval time');
assert.ok(source.includes('renderedQuery!==squish(input.value)||excludedByRevisionSetting(record)') &&
          source.includes('render();return;'),
  'A stale search result may not navigate or reveal a hidden review section');
assert.ok(css.includes('.p-search-popover')&&css.includes('.p-search-result-snippet'),
  'Sticky-header results UI styled');
assert.ok(css.includes('.p-nav-tabs')&&css.includes('.p-nav-tabpanel[hidden]'),
  'Tabbed sidebar styled');
assert.ok(css.includes('#politicsFullSearch'),'Sticky header search styling present');
assert.ok(css.includes('@media print'),'Print remains separate from screen controls');
assert.ok(html.indexOf('src="./assets/js/navigation.js"')<html.indexOf('src="./assets/js/search.js"'),
  'Header search loads after chapter navigation');
// The actual academic book remains intact and should be searchable text.
assert.equal((html.match(/<section class="chapter" id="ch[0-9]{2}"/g)||[]).length,20);
assert.equal((html.match(/<div class="end-matter">/g)||[]).length,20);
assert.equal((html.match(/id="ch[0-9]{2}-sec[0-9]{2}"/g)||[]).length,140);
assert.equal((html.match(/id="ch[0-9]{2}-rev[0-9]{2}"/g)||[]).length,101);
console.log('PASS: full-text matching, header search, sidebar tabs, printing and deep passage navigation');
