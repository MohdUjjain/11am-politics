import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const html=read('index.html');
const nav=read('assets/js/navigation.js');
const css=read('assets/css/navigation.css');
const search=read('assets/js/search.js');
const offline=read('assets/js/offline.js');
const worker=read('service-worker.js');
const helper=read('assets/js/study-material-visibility.js');

// Academic notes are a frozen invariant of this UI-only consolidation.
// The expected SHA is the exact Git blob hash of the unmodified 20 chapters.
const start=html.indexOf('<section class="chapter" id="ch01"');
const end=html.indexOf('<!-- ============================================================ BACK MATTER',start);
assert.ok(start>=0&&end>start,'Twenty-chapter source range must exist');
const chapterText=Buffer.from(html.slice(start,end),'utf8');
const header=Buffer.from('blob '+chapterText.length+'\0','utf8');
const digest=createHash('sha1').update(header).update(chapterText).digest('hex');
assert.equal(digest,'355c07dcedb475b00d1bc4b9e9f2789f9b816507',
  'Academic source text or chapter formatting changed during UI-only consolidation');

// No obsolete summary-only UI identifiers; preserve the intentionally historical
// localStorage LEGACY_KEY for existing readers.
for(const [filename,source] of Object.entries({
  'index.html':html,'navigation.js':nav,'navigation.css':css,
  'search.js':search,'offline.js':offline,'service-worker.js':worker
})){
  for(const obsolete of [
    'politicsShowSummaries','politicsSummariesHint',
    'politics-hide-chapter-summaries','PoliticsSummaryVisibility',
    'summaryVisibility','showSummaries','summary-visibility.js'
  ]){
    assert.ok(!source.includes(obsolete),
      filename+' still references obsolete interface name '+obsolete);
  }
}
assert.ok(html.includes('src="./assets/js/study-material-visibility.js"'));
assert.ok(nav.includes('window.PoliticsStudyMaterialVisibility'));
assert.ok(nav.includes('studyMaterialVisibility.write(localStorage,showStudyMaterial)'));
assert.ok(css.includes('body.politics-hide-study-material .chapter > .end-matter'));
assert.ok(search.includes("politics-hide-study-material"));
assert.ok(offline.includes("'./assets/js/study-material-visibility.js'"));
assert.ok(worker.includes("'./assets/js/study-material-visibility.js'"));
assert.ok(helper.includes("KEY='11am-politics:show-end-of-chapter-material-v2'"),
  'Existing saved preferences must use the original v2 key');
assert.ok(helper.includes("LEGACY_KEY='11am-politics:show-chapter-summaries-v1'"),
  'Legacy saved preferences remain migratable');
assert.ok(!nav.includes("get('politicsNavResults')"));
assert.ok(!nav.includes('function fold('));
assert.ok(!nav.includes('chapterLinks'));
assert.ok(!nav.includes('manualOpen'),
  'No unused pre-search accordion state should remain');

for(const name of [
  '--p-ui-surface','--p-ui-parchment','--p-ui-hover','--p-ui-selected',
  '--p-ui-divider','--p-ui-focus','--p-ui-radius','--p-ui-touch',
  '--p-ui-highlight','--p-ui-font','--p-ui-font-meta'
])assert.ok(css.includes(name+':'), 'Missing reader design token '+name);

assert.ok(html.includes('politicsEditionVersion')&&html.includes('politicsNavPrint'));
assert.ok(nav.includes('continueReading')&&nav.includes('syncLinkedRevision'));
assert.ok(css.includes('@media print'));
console.log('PASS: frozen 20-chapter academic source, semantic naming, saved preference keys, CSS tokens and no dead sidebar search');
