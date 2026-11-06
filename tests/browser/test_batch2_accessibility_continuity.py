#!/usr/bin/env python3
"""Batch 2: mobile overflow keyboard navigation and updated-edition checkpoint."""
from __future__ import annotations
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
FIX=json.loads((ROOT/'tests/fixtures/batch2_modified_edition.json').read_text())
KEY='11am-politics:reading-position-v2'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass

def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
        page=context.new_page()
        url=f'http://127.0.0.1:{server.server_port}/index.html'
        page.goto(url,wait_until='domcontentloaded')
        page.wait_for_function("document.querySelectorAll('.p-nav-chapter').length===20")
        # Explicitly induce overflow so this test remains deterministic when
        # the authored table widths/fonts change between editions.
        dimensions=page.evaluate("""() => {
          const wrap=document.querySelector('section.chapter .table-wrap');
          const table=wrap.querySelector('table');
          wrap.style.width='290px';table.style.minWidth='900px';
          window.dispatchEvent(new Event('resize'));
          return {scroll:wrap.scrollWidth,client:wrap.clientWidth};
        }""")
        assert dimensions['scroll']>dimensions['client']+3,dimensions
        page.wait_for_function("""() => {
          const e=document.querySelector('section.chapter .table-wrap');
          return e.tabIndex===0 && e.getAttribute('role')==='region' &&
            !!e.getAttribute('aria-describedby');
        }""",timeout=4000)
        info=page.evaluate("""() => {
          const e=document.querySelector('section.chapter .table-wrap');
          return {label:e.getAttribute('aria-label'),hint:document.getElementById(e.getAttribute('aria-describedby'))?.textContent};
        }""")
        assert info['label'] and info['hint'],info
        wrap=page.locator('section.chapter .table-wrap').first
        wrap.focus()
        assert wrap.evaluate("e=>document.activeElement===e")
        start=wrap.evaluate('e=>e.scrollLeft')
        page.keyboard.press('ArrowRight')
        page.wait_for_function("""() => document.querySelector('section.chapter .table-wrap').scrollLeft>0""")
        assert wrap.evaluate('e=>e.scrollLeft')>start
        page.evaluate("""() => {
          const e=document.querySelector('section.chapter .table-wrap');
          e.style.width='2000px';e.querySelector('table').style.minWidth='0';
          e.style.overflow='visible'; e.querySelector('table').style.width='100%';
        }""")
        page.evaluate("window.dispatchEvent(new Event('resize'))")
        page.wait_for_function("""() => {
          const e=document.querySelector('section.chapter .table-wrap');
          return e.scrollWidth<=e.clientWidth+3 && !e.hasAttribute('tabindex') && !e.hasAttribute('aria-describedby');
        }""",timeout=4000)
        context.close()

        # Modified-edition fixture: a saved section was renamed in the
        # publication, but chapter identity and saved reading fraction remain.
        context=browser.new_context(viewport={'width':1100,'height':760},
                                    service_workers='block',reduced_motion='reduce')
        initial=json.dumps(FIX['checkpoint'])
        script=f"""localStorage.setItem({json.dumps(KEY)}, {json.dumps(initial)});
localStorage.setItem({json.dumps(FIX['visibilityKey'])},{json.dumps(FIX['visibility'])});"""
        context.add_init_script(script=script)
        old=f'id="{FIX["oldAnchor"]}"'; new=f'id="{FIX["newAnchor"]}"'
        html=(ROOT/'index.html').read_text(encoding='utf8')
        assert old in html,old
        mutated=html.replace(old,new,1)
        context.route('**/index.html',lambda route:route.fulfill(status=200,
                      content_type='text/html',body=mutated))
        page=context.new_page();page.goto(url,wait_until='domcontentloaded')
        page.wait_for_function("document.querySelectorAll('.p-nav-chapter').length===20")
        assert page.locator('#'+FIX['oldAnchor']).count()==0
        assert page.evaluate("key=>JSON.parse(localStorage.getItem(key)).anchorId",KEY)==FIX['oldAnchor']
        page.locator('#politicsContinuePrompt').wait_for(state='visible',timeout=8000)
        page.locator('#politicsContinueButton').click()
        page.wait_for_function("() => location.hash==='#ch05'")
        # The URL is updated synchronously. Focus is deliberately moved in a
        # requestAnimationFrame callback, so await that visible user outcome.
        page.wait_for_function("() => document.activeElement.id==='ch05'",timeout=5000)
        assert page.evaluate('window.scrollY')>100
        assert page.evaluate("key=>localStorage.getItem(key)",FIX['visibilityKey'])=='false'
        context.close()
        browser.close()
    finally:
      server.shutdown();server.server_close()
    print('PASS: horizontally overflowing tables are keyboard-accessible; renamed-section edition migrates to saved chapter')
if __name__=='__main__': main()
