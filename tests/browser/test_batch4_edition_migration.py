#!/usr/bin/env python3
"""Batch D: real Politics section insert/reorder, old local-storage migration and hidden study aids."""
from __future__ import annotations
import json
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
KEY='11am-politics:reading-position-v2'
LEGACY='11am-politics:last-reading'
PREF='11am-politics:show-end-of-chapter-material-v2'
HTML=(ROOT/'index.html').read_text(encoding='utf8')
marker=HTML.index('navigation.js')
at=HTML.rfind('<script',0,marker)
assert at>0, 'No pre-navigation injection point'
MUTATION=r"""<script>
(function(){
 const saved=document.getElementById('ch05-sec03'),
       ch=document.getElementById('ch05');
 if(!saved||!ch)throw Error('Existing Politics source section not found');
 const all=[...ch.querySelectorAll('.content h2[id]')];
 const original=all.indexOf(saved),first=all[0],parent=saved.parentElement;
 if(original<1||parent!==first.parentElement)throw Error('Fixture requires sibling sections');
 const chunk=[];
 for(let node=saved;node && (node===saved || !node.matches('h2[id]'));node=node.nextElementSibling)chunk.push(node);
 chunk.forEach(node=>parent.insertBefore(node,first));
 const heading=document.createElement('h2');
 heading.id='ch05-sec88';heading.lang='ar';heading.dir='rtl';
 heading.textContent='المفهوم السياسي — New comparative framework';
 parent.insertBefore(heading,first);
 const p=document.createElement('p');
 p.textContent='New commentary added to the revised chapter, shifting the preceding sections. '.repeat(10);
 parent.insertBefore(p,first);
 window.__batchD={before:original,after:[...ch.querySelectorAll('.content h2[id]')].indexOf(saved),
   added:!!document.getElementById('ch05-sec88'),moved:chunk.length};
})();
</script>"""
ALTERED=HTML[:at]+MUTATION+HTML[at:]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

def main():
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
 Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
   url=f'http://127.0.0.1:{server.server_port}/index.html'
   def open_edition(saved,width=390,old=False):
    ctx=browser.new_context(viewport={'width':width,'height':844},reduced_motion='reduce',service_workers='block')
    storage=LEGACY if old else KEY
    initial=saved if old else json.dumps(saved)
    ctx.add_init_script(script=f"localStorage.setItem({json.dumps(storage)},{json.dumps(initial)});localStorage.setItem({json.dumps(PREF)},'false');")
    ctx.route('**/index.html',lambda route:route.fulfill(status=200,content_type='text/html',body=ALTERED))
    page=ctx.new_page();page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("document.querySelectorAll('.p-nav-chapter').length===20")
    assert page.evaluate('window.__batchD')['added']
    assert page.evaluate('window.__batchD')['before']!=page.evaluate('window.__batchD')['after']
    assert page.locator('#ch05-sec88[lang="ar"][dir="rtl"]').count()==1
    page.locator('#politicsContinuePrompt').wait_for(state='visible',timeout=10000)
    if not old:assert page.evaluate("k=>JSON.parse(localStorage.getItem(k))",KEY)==saved
    return ctx,page

   checkpoint={'v':2,'chapterId':'ch05','anchorId':'ch05-sec03',
               'anchorFraction':.31,'chapterFraction':.46,'savedAt':1730000000000}
   for width in (390,1100):
    ctx,page=open_edition(checkpoint,width)
    page.locator('#politicsContinueButton').click()
    page.wait_for_function("() => location.hash==='#ch05-sec03'")
    # URL changes synchronously, but keyboard focus moves next animation frame.
    page.wait_for_function("() => document.activeElement.id==='ch05-sec03'")
    result=page.evaluate("""() => {
      const h=document.getElementById('ch05-sec03'),
       list=[...document.querySelectorAll('#ch05 .content h2[id]')],i=list.indexOf(h),
       next=list[i+1],ch=document.getElementById('ch05');
      const start=h.getBoundingClientRect().top+scrollY,
        stop=next?next.getBoundingClientRect().top+scrollY:ch.getBoundingClientRect().bottom+scrollY;
      return {chapter:ch.id,index:i,actual:scrollY,
        expected:Math.max(0,start+.31*Math.max(0,stop-start)-innerHeight*.36),
        focus:document.activeElement?.id};
    }""")
    assert result['chapter']=='ch05' and result['index']!=2,result
    assert abs(result['actual']-result['expected'])<85,result
    assert result['focus']=='ch05-sec03',result
    assert page.evaluate('k=>localStorage.getItem(k)',PREF)=='false'
    ctx.close()

    # The oldest last-reading storage key is migrated to the v2 checkpoint
    # using the same application logic and without silently changing visibility.
    ctx,page=open_edition('ch05-sec03',width,old=True)
    page.wait_for_function("() => !!localStorage.getItem('11am-politics:reading-position-v2')")
    migrated=page.evaluate("k=>JSON.parse(localStorage.getItem(k))",KEY)
    assert migrated['chapterId']=='ch05' and migrated['anchorId']=='ch05-sec03',migrated
    assert page.evaluate('k=>localStorage.getItem(k)',LEGACY) is None
    page.locator('#politicsContinueButton').click()
    page.wait_for_function("() => location.hash==='#ch05-sec03'")
    assert page.evaluate('k=>localStorage.getItem(k)',PREF)=='false'
    ctx.close()

   revision={'v':2,'chapterId':'ch07','anchorId':'ch07-rev03',
             'anchorFraction':.18,'chapterFraction':.89,'savedAt':1730000000000}
   ctx,page=open_edition(revision,390)
   page.locator('#politicsContinueButton').click()
   page.wait_for_function("() => !!document.getElementById('ch07-rev03')?.closest('.end-matter.politics-explicit-revision')")
   assert not page.locator('#politicsShowStudyMaterial').is_checked()
   assert page.evaluate('k=>localStorage.getItem(k)',PREF)=='false'
   ctx.close();browser.close()
 finally:
  server.shutdown();server.server_close()
 print('PASS Batch D Politics: real reordered and inserted sections, stable anchored offset, v1 storage-key migration, bilingual content, hidden revision preference')

if __name__=='__main__':main()
