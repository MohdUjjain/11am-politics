#!/usr/bin/env python3
"""Browser regression: search obeys the user's hidden end-matter preference."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[2]
PREF='11am-politics:show-end-of-chapter-material-v2'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

def run():
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
 Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
   for width in (390,1100):
    ctx=browser.new_context(viewport={'width':width,'height':844},
                             reduced_motion='reduce',service_workers='block')
    ctx.add_init_script(script=f"localStorage.setItem('{PREF}','false')")
    page=ctx.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/index.html',wait_until='domcontentloaded')
    page.wait_for_function("document.querySelectorAll('.p-nav-chapter').length===20")
    search=page.locator('#politicsFullSearch')
    search.fill('📋 Chapter Summary')
    expect(page.locator('#politicsSearchPopover')).to_be_visible()
    hidden=page.locator('.p-search-result').count()
    hidden_sections=page.locator('.p-search-result-section').all_inner_texts()
    assert not any(s.strip()=='📋 Chapter Summary' for s in hidden_sections),hidden_sections
    assert page.locator('.politics-explicit-revision').count()==0
    # Toggling the actual Tools checkbox must refresh an already-open query.
    def change(visible):
     page.evaluate("""value=>{
       const el=document.getElementById('politicsShowStudyMaterial');
       el.checked=value;el.dispatchEvent(new Event('change',{bubbles:true}));
     }""",visible)
    change(True)
    page.wait_for_function("() => document.querySelectorAll('.p-search-result').length>=20")
    visible=page.locator('.p-search-result').count()
    assert visible>hidden,(hidden,visible)
    change(False)
    page.wait_for_function("(count) => document.querySelectorAll('.p-search-result').length===count",arg=hidden)
    assert page.evaluate(f"localStorage.getItem('{PREF}')")=='false'
    assert page.locator('.politics-explicit-revision').count()==0
    search.fill('politics')
    expect(page.locator('.p-search-result').first).to_be_visible()
    page.locator('.p-search-result').first.click()
    assert page.locator('#politicsSearchPopover').is_hidden()
    assert page.locator('.politics-explicit-revision').count()==0
    assert not page.evaluate('document.activeElement.closest(".end-matter") !== null')
    ctx.close()
    print('PASS Politics hidden end-matter filtered in search, no auto-reveal, width',width)
   browser.close()
 finally:
  server.shutdown();server.server_close()

if __name__=='__main__':run()
