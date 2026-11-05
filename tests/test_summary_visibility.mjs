import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const visibility=require('../summary-visibility.js');
function makeStorage(){
  const map=new Map();
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
}
const memory=makeStorage();
assert.equal(visibility.read(memory),true,'Default is to show all summaries');
assert.equal(visibility.isSummaryAnchor('ch01-rev01'),true);
assert.equal(visibility.isSummaryAnchor('ch20-rev01'),true);
assert.equal(visibility.isSummaryAnchor('ch07-rev02'),false);
assert.equal(visibility.isSummaryAnchor('ch07-sec01'),false);
assert.equal(visibility.isSummaryAnchor('ch99-rev01'),false);
assert.equal(visibility.write(memory,false),true);
assert.equal(visibility.read(memory),false,'Hide preference is stored');
delete require.cache[require.resolve('../summary-visibility.js')];
const nextLaunch=require('../summary-visibility.js');
assert.equal(nextLaunch.read(memory),false,'Hide preference persists after relaunch');
assert.equal(nextLaunch.write(memory,true),true);
assert.equal(nextLaunch.read(memory),true,'Reader may re-enable summaries');
assert.equal(nextLaunch.read({getItem:()=>{throw Error('storage disabled')}}),true,'Storage failure defaults to visible');
assert.equal(nextLaunch.write({setItem:()=>{throw Error('storage disabled')}},false),false);

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../navigation.css',import.meta.url),'utf8');
const nav=readFileSync(new URL('../navigation.js',import.meta.url),'utf8');
const summaryMarkup=/<div class="em-title" id="ch\d{2}-rev01">📋 Chapter Summary<\/div>\s*<p>/g;
assert.equal([...html.matchAll(summaryMarkup)].length,20,
  'Every chapter has a summary heading followed by a single paragraph');
assert.match(html, /id="politicsShowSummaries" checked/,
  'Native checkbox is available in the sidebar');
assert.ok(html.indexOf('src="./summary-visibility.js"')<
  html.indexOf('src="./navigation.js"'),
  'Preference helper must be ready before the navigation controller');

assert.match(css, /@media screen\s*\{/);
assert.ok(css.includes('body.politics-hide-chapter-summaries .chapter .end-matter > .em-title[id$="-rev01"] + p'),
  'Only chapter-summary paragraph is hidden in the reading view');
assert.ok(css.includes('.em-title[id$="-rev01"]:target + p'),
  'An explicit deep-linked chapter summary remains available');
assert.match(css, /@media print\s*\{/);
assert.ok(css.indexOf('body.politics-hide-chapter-summaries')<css.indexOf('@media print'),
  'Visibility preference rules are screen-only; printing retains the full book');
assert.ok(nav.includes("summaryVisibility.write(localStorage,showSummaries)"));
assert.ok(nav.includes("summaryVisibility.read(localStorage)"));
assert.ok(nav.includes("summaryToggle.addEventListener('change'"));
assert.ok(nav.includes('if(!heading.getClientRects().length)continue'),
  'Scroll tracking must skip hidden section headings');
assert.ok(nav.includes("const hiddenSummary=!showSummaries")&&
  nav.includes("data.anchorId"),
  'Resume reading must fall back from a hidden summary');
assert.ok(nav.includes("location.hash!=='#'+a.dataset.targetId"),
  'Direct deep links should retain a visible summary shortcut');
console.log('PASS: summary visibility, persisted choice, deep links, print, reading position');
