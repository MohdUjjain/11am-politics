#!/usr/bin/env python3
"""Batch B Chromium checks: mobile UI, modal isolation, search ARIA, motion, contrast."""
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_args):pass

def luminance(color):
    channels=[int(n)/255 for n in re.findall(r"[0-9]+",color)[:3]]
    linear=[v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4 for v in channels]
    return sum(v*w for v,w in zip(linear,(0.2126,0.7152,0.0722)))

def check():
    server=ThreadingHTTPServer(("127.0.0.1",0),partial(Quiet,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    url=f"http://127.0.0.1:{server.server_port}/index.html"
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for width,height in [(320,568),(390,844),(600,850),(1280,800)]:
          ctx=browser.new_context(viewport={"width":width,"height":height},
                                  service_workers="block")
          ctx.route(re.compile(r"^https://fonts\.(googleapis|gstatic)\.com/"),
                    lambda route:route.abort())
          page=ctx.new_page()
          errors=[]
          page.on("pageerror",lambda e:errors.append(str(e)))
          page.goto(url,wait_until="domcontentloaded")
          page.wait_for_function("() => document.querySelectorAll('.p-nav-group').length===6")
          assert not errors,errors

          if width<=600:
            assert page.locator("#politicsCompactChapter").is_visible()
            header=page.evaluate("""() => {
              const rect=id=>document.getElementById(id).getBoundingClientRect();
              const menu=rect('politicsNavFab');
              const search=rect('politicsFullSearch');
              const label=rect('politicsCompactChapter');
              const ring=rect('politicsChapterProgress');
              return {menu:{right:menu.right,width:menu.width},
                search:{left:search.left,right:search.right,width:search.width},
                label:{left:label.left,right:label.right},
                ring:{left:ring.left,right:ring.right},
                viewport:innerWidth,
                size:getComputedStyle(document.getElementById('politicsFullSearch')).fontSize};
            }""")
            assert header["menu"]["width"]>=44,header
            assert header["search"]["width"]>=100,header
            assert header["menu"]["right"]<=header["search"]["left"]+2,header
            assert header["search"]["right"]<=header["label"]["left"]+2,header
            assert header["ring"]["right"]<=header["viewport"]+1,header
            assert header["size"]=="16px",header

            # Scroll near the start of chapter eight so the responsive
            # chapter identity is meaningful independently of the ring.
            page.evaluate("""() => {
              const ch=document.getElementById('ch08');
              scrollTo(0,ch.getBoundingClientRect().top+scrollY-105);
            }""")
            expect(page.locator("#politicsCompactChapter")).to_have_text("Ch. 08")
          else:
            assert page.locator("#politicsCompactChapter").is_hidden()

          page.locator("#politicsNavFab").click()
          expect(page.locator("#politicsNavPanel")).to_be_visible()
          isolation=page.evaluate("""() => ({
            main:document.getElementById('politicsMainContent').inert,
            header:document.getElementById('politicsReadingHeader').inert,
            trigger:document.getElementById('politicsNavFab').inert,
            backdrop:document.getElementById('politicsNavBackdrop').inert,
            focused:document.activeElement?.id,
            chapterToggle:document.querySelector('.p-nav-chapter-toggle')
              .getBoundingClientRect().height,
            close:document.getElementById('politicsNavClose').getBoundingClientRect().height
          })""")
          assert isolation["main"] and isolation["header"] and isolation["trigger"],isolation
          assert not isolation["backdrop"] and isolation["focused"]=="politicsNavClose",isolation
          assert isolation["chapterToggle"]>=44 and isolation["close"]>=44,isolation

          # '/' must not focus a combobox outside an open modal.
          page.keyboard.press("/")
          assert page.evaluate("document.activeElement.id")!="politicsFullSearch"
          page.keyboard.press("Tab")
          assert page.evaluate("document.getElementById('politicsNavPanel').contains(document.activeElement)")
          page.get_by_role("tab",name="Tools").click()
          expect(page.get_by_role("tabpanel",name="Tools")).to_be_visible()
          page.keyboard.press("Escape")
          assert page.locator("#politicsNavPanel").get_attribute("aria-hidden")=="true"
          restored=page.evaluate("""() => ({
            main:document.getElementById('politicsMainContent').inert,
            header:document.getElementById('politicsReadingHeader').inert,
            active:document.activeElement.id
          })""")
          assert restored=={"main":False,"header":False,"active":"politicsNavFab"},restored

          # Dialog opening must restore pre-existing inert values.
          page.evaluate("document.querySelector('.offline-panel').inert=true")
          page.locator("#politicsNavFab").click()
          page.locator("#politicsNavClose").click()
          assert page.evaluate("document.querySelector('.offline-panel').inert") is True
          page.evaluate("document.querySelector('.offline-panel').inert=false")

          # The mobile print action restores trigger focus after closing.
          page.evaluate("window.print=()=>{window.__printTest=true}")
          page.locator("#politicsNavFab").click()
          page.get_by_role("tab",name="Tools").click()
          page.locator("#politicsNavPrint").click()
          page.wait_for_function("() => window.__printTest === true")
          assert page.evaluate("document.activeElement.id")=="politicsNavFab"

          # Search uses a combobox and listbox with active descendant while
          # keyboard focus stays in the input until a passage is selected.
          search=page.locator("#politicsFullSearch")
          search.fill("politics")
          expect(page.get_by_role("listbox",name="Matching note passages")
                     .get_by_role("option").first).to_be_visible()
          assert search.get_attribute("role")=="combobox"
          assert search.get_attribute("aria-expanded")=="true"
          page.keyboard.press("ArrowDown")
          active=search.get_attribute("aria-activedescendant")
          assert active and active.endswith("-0"),active
          assert page.evaluate("document.activeElement.id")=="politicsFullSearch"
          assert page.locator("#"+active).get_attribute("aria-selected")=="true"
          page.keyboard.press("ArrowDown")
          assert search.get_attribute("aria-activedescendant").endswith("-1")
          page.keyboard.press("ArrowUp")
          assert search.get_attribute("aria-activedescendant").endswith("-0")
          page.keyboard.press("Escape")
          expect(page.locator("#politicsSearchPopover")).to_be_hidden()
          assert page.evaluate("document.activeElement.id")=="politicsFullSearch"
          assert search.get_attribute("aria-activedescendant") is None

          search.fill("politics")
          expect(page.locator("#politicsSearchMore")).to_be_visible()
          page.locator("#politicsSearchMore").click()
          assert page.get_by_role("listbox").get_by_role("option").count()==70
          assert page.evaluate("document.activeElement.id")=="politicsFullSearch"
          assert search.get_attribute("aria-activedescendant").endswith("-35")
          page.locator("#politicsSearchClose").click()
          expect(page.locator("#politicsSearchPopover")).to_be_hidden()
          assert page.evaluate("document.activeElement.id")=="politicsFullSearch"
          page.wait_for_timeout(150)
          assert page.locator("#politicsSearchPopover").is_hidden()

          # Reduced-motion users should not get CSS smooth scrolling or
          # chapter/drawer transitions.
          page.emulate_media(reduced_motion="reduce")
          assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior")=="auto"
          assert page.evaluate("getComputedStyle(document.getElementById('politicsNavPanel')).transitionDuration")=="0s"
          assert not errors,errors
          print(f"PASS: responsive and accessible navigation at {width}px")
          ctx.close()

        # Contrast of the brightest chapter header gradients' leading stops.
        contrast_ctx=browser.new_context(viewport={"width":1280,"height":800},
                                         service_workers="block")
        contrast_page=contrast_ctx.new_page()
        contrast_page.goto(url,wait_until="domcontentloaded")
        for ch in ("ch13","ch14"):
          style=contrast_page.evaluate("""id=>{
            const banner=document.querySelector('#'+id+' .chapter-tab');
            const computed=getComputedStyle(banner);
            const kicker=getComputedStyle(banner.querySelector('.kicker'));
            return {gradient:computed.backgroundImage,opacity:kicker.opacity};
          }""",ch)
          stop=re.search(r"rgb\([\d, ]+\)",style["gradient"])
          assert stop,style
          ratio=1.05/(luminance(stop.group(0))+0.05)
          assert ratio>=4.5,(ch,ratio,style)
          assert style["opacity"]=="1",style
          print(f"PASS: {ch} brightest gradient white-text contrast {ratio:.2f}:1")
        contrast_ctx.close()
        browser.close()
    finally:
      server.shutdown()
      server.server_close()

if __name__=="__main__":check()
