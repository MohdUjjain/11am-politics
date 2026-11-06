#!/usr/bin/env python3
"""Chromium: a visible, accessible non-modal Politics resume/update notice surface."""
from __future__ import annotations
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[2]
KEY='11am-politics:reading-position-v2'
PREF='11am-politics:show-end-of-chapter-material-v2'
CHECKPOINT={'v':2,'chapterId':'ch05','anchorId':'ch05-sec03',
            'anchorFraction':0.25,'chapterFraction':0.4,'savedAt':1730000000000}

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

def run():
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
 Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
   url=f'http://127.0.0.1:{server.server_port}/index.html'
   for width in (320,390,1280):
    ctx=browser.new_context(viewport={'width':width,'height':780},reduced_motion='reduce',service_workers='block')
    ctx.add_init_script(script=f"localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(CHECKPOINT))});localStorage.setItem({json.dumps(PREF)},'false');")
    page=ctx.new_page();page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("() => document.querySelectorAll('.p-nav-chapter').length===20")
    dock=page.locator('#politicsNoticeDock')
    resume=page.locator('#politicsContinuePrompt')
    update=page.locator('#politicsEditionNotice')
    expect(resume).to_be_visible(timeout=10000)
    expect(update).to_be_hidden()
    assert dock.get_attribute('aria-live')=='polite'
    assert not page.locator('#book-cover').evaluate("e=>e.contains(document.getElementById('politicsContinuePrompt'))")
    bounds=page.evaluate("""() => {
      const r=document.querySelector('#politicsNoticeDock').getBoundingClientRect(),
        offline=document.querySelector('#offlineToggle').getBoundingClientRect(),
        header=document.querySelector('#politicsReadingHeader').getBoundingClientRect();
      const el=document.querySelector('#politicsNoticeDock');
      return {position:getComputedStyle(el).position,top:r.top,bottom:r.bottom,left:r.left,
        right:r.right,headerBottom:header.bottom,offlineTop:offline.top,
        scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
    }""")
    assert bounds['position']=='fixed',bounds
    assert bounds['left']>=0 and bounds['right']<=width+1,bounds
    assert bounds['top']>=bounds['headerBottom']-1,bounds
    assert bounds['bottom']<bounds['offlineTop'],bounds
    assert bounds['scrollWidth']<=width+3,bounds
    assert page.evaluate("k=>JSON.parse(localStorage.getItem(k))",KEY)==CHECKPOINT
    expect(page.locator('#politicsContinueDescription')).to_contain_text('Chapter 05')
    page.locator('#politicsNavFab').click()
    expect(dock).to_be_hidden()
    assert page.locator('#politicsNavPanel').get_attribute('aria-hidden')=='false'
    page.keyboard.press('Escape')
    expect(resume).to_be_visible()
    assert not page.evaluate("document.getElementById('politicsMainContent').inert")
    assert page.evaluate("document.activeElement.id")=='politicsNavFab'

    # A ready newer edition takes priority, not a second overlapping card.
    page.evaluate("""() => {
      window.__politicsEditionReady=true;
      window.dispatchEvent(new CustomEvent('politics:edition-notice',
        {detail:{available:true}}));
    }""")
    expect(update).to_be_visible()
    expect(resume).to_be_hidden()
    assert page.locator('#politicsNoticeDock > section:visible').count()==1
    expect(page.locator('#politicsEditionNoticeReload')).to_be_visible()
    page.locator('#politicsEditionNoticeDismiss').click()
    expect(update).to_be_hidden()
    expect(resume).to_be_visible()
    assert page.evaluate("k=>JSON.parse(localStorage.getItem(k))",KEY)==CHECKPOINT

    # With the update dismissed, Escape dismisses Resume and restores focus.
    page.locator('#politicsContinueButton').focus()
    page.keyboard.press('Escape')
    expect(dock).to_be_hidden()
    assert page.evaluate('document.activeElement.id')=='politicsNavFab'
    assert page.evaluate("k=>JSON.parse(localStorage.getItem(k))",KEY)==CHECKPOINT
    assert page.evaluate("k=>localStorage.getItem(k)",PREF)=='false'

    # A new page visit should offer to continue again; dismissal is not a
    # destructive "Forget saved place" operation.
    page.reload(wait_until='domcontentloaded')
    expect(resume).to_be_visible(timeout=10000)
    page.emulate_media(media='print')
    assert page.locator('#politicsNoticeDock').evaluate("e=>getComputedStyle(e).display")=='none'
    page.emulate_media(media='screen')
    expect(resume).to_be_visible()
    page.locator('#politicsContinueButton').click()
    page.wait_for_function("() => location.hash==='#ch05-sec03'")
    page.wait_for_function("() => document.activeElement.id==='ch05-sec03'")
    expect(dock).to_be_hidden()
    assert page.evaluate("k=>localStorage.getItem(k)",PREF)=='false'
    ctx.close()
    print('PASS notice priority, keyboard focus, mobile geometry, print exclusion and resume @',width)

   # The new update prompt must work with no bookmark as well.
   ctx=browser.new_context(viewport={'width':390,'height':780},service_workers='block')
   page=ctx.new_page();page.goto(url,wait_until='domcontentloaded')
   expect(page.locator('#politicsNoticeDock')).to_be_hidden()
   page.evaluate("window.dispatchEvent(new CustomEvent('politics:edition-notice',{detail:{available:true}}))")
   expect(page.locator('#politicsEditionNotice')).to_be_visible()
   expect(page.locator('#politicsContinuePrompt')).to_be_hidden()
   page.locator('#politicsEditionNoticeDismiss').click()
   expect(page.locator('#politicsNoticeDock')).to_be_hidden()
   ctx.close();browser.close()
 finally:
  server.shutdown();server.server_close()
 print('PASS: shared floating Politics notice preserves checkpoint and favors edition update without double overlays')

if __name__=='__main__':run()
