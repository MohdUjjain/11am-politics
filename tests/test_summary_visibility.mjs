import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const visibility=require('../summary-visibility.js');

function storage(){
  const map=new Map();
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
}
const s=storage();
assert.equal(visibility.read(s),true,'All end-of-chapter material shown by default');
for(let n=1;n<=20;n++){
  const ch='ch'+String(n).padStart(2,'0');
  for(let revision=1;revision<=5;revision++){
    assert.equal(visibility.isRevisionAnchor(ch+'-rev'+String(revision).padStart(2,'0')),true);
  }
}
assert.equal(visibility.isRevisionAnchor('ch07-rev06'),true,
  'Chapter 7 extra philosopher table must also be covered');
assert.equal(visibility.isRevisionAnchor('ch07-sec06'),false);
assert.equal(visibility.isRevisionAnchor('ch21-rev01'),false);

assert.equal(visibility.write(s,false),true);
assert.equal(visibility.read(s),false,'Hide preference saved');
delete require.cache[require.resolve('../summary-visibility.js')];
const next=require('../summary-visibility.js');
assert.equal(next.read(s),false,'Hide preference survives a restart');
assert.equal(next.write(s,true),true);
assert.equal(next.read(s),true,'User can re-enable end-matter');

// Preserve the existing setting when upgrading from the summary-only release.
const legacy=storage();
legacy.setItem(visibility.LEGACY_KEY,'false');
assert.equal(next.read(legacy),false,'Existing hidden preference migrates');
assert.equal(legacy.getItem(next.KEY),'false');
assert.equal(legacy.getItem(next.LEGACY_KEY),null);
const oldShow=storage();
oldShow.setItem(next.LEGACY_KEY,'true');
assert.equal(next.read(oldShow),true);
assert.equal(next.read({getItem:()=>{throw Error('blocked')}}),true);
assert.equal(next.write({setItem:()=>{throw Error('blocked')}},false),false);

// Source remains fully present: only a single CSS display rule hides each
// entire end-matter container on screens; printing is unaffected.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../navigation.css',import.meta.url),'utf8');
const nav=readFileSync(new URL('../navigation.js',import.meta.url),'utf8');
assert.equal((html.match(/<div class="end-matter">/g)||[]).length,20,
  'Every chapter retains its original study-material container');
assert.equal((html.match(/<div class="em-title" id="ch[0-9]{2}-rev[0-9]{2}">/g)||[]).length,101,
  'All revision headings are still in the book');
assert.match(html,/Show End-of-Chapter Study Material/);
assert.match(html,/id="politicsShowSummaries" checked/);
assert.match(css,/@media screen\s*\{/);
assert.ok(css.includes('body.politics-hide-chapter-summaries .chapter > .end-matter {'));
assert.ok(css.includes('display:none!important;'));
assert.ok(css.includes('.end-matter.politics-explicit-revision'),
  'Direct section links can reveal the requested end-matter');
assert.ok(css.indexOf('body.politics-hide-chapter-summaries')<css.indexOf('@media print'),
  'The summary toggle does not alter printed pages');
assert.ok(nav.includes('summaryVisibility.isRevisionAnchor'));
assert.ok(nav.includes("revisionLabel.hidden=hideRevision"),
  'The revision label must also vanish from the sidebar');
assert.ok(nav.includes('const hiddenRevision=hideRevision&&'),
  'All revision links must be hidden from the sidebar when requested');
assert.ok(nav.includes('if(!heading.getClientRects().length)continue'),
  'Scroll position tracking skips hidden headings');
assert.ok(nav.includes('syncLinkedRevision()'),
  'Direct revision links remain possible without altering the saved choice');
assert.ok(nav.includes('summaryVisibility.write(localStorage,showSummaries)'));
assert.ok(html.indexOf('src="./summary-visibility.js"')<
  html.indexOf('src="./navigation.js"'));
console.log('PASS: hide all 20 end-matter sections, migration, shortcuts, direct links and print');
