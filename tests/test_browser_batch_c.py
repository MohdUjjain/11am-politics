#!/usr/bin/env python3
"""Batch C: real Chromium profile restarts, hidden-section resume and edition checks."""
from __future__ import annotations

import re
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
STORAGE_KEY = "11am-politics:reading-position-v2"
PREF_KEY = "11am-politics:show-end-of-chapter-material-v2"

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):pass

def visit_with_profile(playwright, profile, url):
    # Closing and relaunching this persistent context closes the actual
    # Chromium process, while retaining the browser-managed disk profile.
    ctx = playwright.chromium.launch_persistent_context(
        user_data_dir=str(profile), headless=True, service_workers="block",
        viewport={"width": 1100, "height": 760},
    )
    ctx.route(re.compile(r"^https://fonts\.(googleapis|gstatic)\.com/"),
              lambda route:route.abort())
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_function(
        "() => document.querySelectorAll('.p-nav-chapter').length === 20"
    )
    return ctx, page

def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0),
        partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/index.html"
    try:
      with sync_playwright() as p, tempfile.TemporaryDirectory() as work:
        root = Path(work)
        profile = root / "reading-profile"
        ctx,page = visit_with_profile(p,profile,url)
        assert page.locator("#politicsContinuePrompt").is_hidden()
        page.evaluate("""() => {
          const heading=document.querySelector('#ch05-sec03');
          const y=heading.getBoundingClientRect().top+scrollY-innerHeight*.2;
          scrollTo({top:y,behavior:'instant'});
        }""")
        page.wait_for_function("""key=>{
          const raw=localStorage.getItem(key);
          return !!raw && JSON.parse(raw).anchorId==='ch05-sec03';
        }""", arg=STORAGE_KEY)
        before=page.evaluate("key=>JSON.parse(localStorage.getItem(key))",STORAGE_KEY)
        assert before["anchorFraction"]>=0
        assert before["chapterId"]=="ch05"
        ctx.close() # Real browser-process close; not a simulated reload.

        ctx,page=visit_with_profile(p,profile,url)
        expect(page.locator("#politicsContinuePrompt")).to_be_visible(timeout=10000)
        expect(page.locator("#politicsContinueDescription")).to_contain_text("Chapter 05")
        assert page.evaluate("key=>JSON.parse(localStorage.getItem(key)).anchorId",STORAGE_KEY)=="ch05-sec03"
        page.locator("#politicsContinueButton").click()
        page.wait_for_function("() => location.hash==='#ch05-sec03'")
        resumed=page.evaluate("""() => ({
          focus:document.activeElement.id,
          top:document.querySelector('#ch05-sec03').getBoundingClientRect().top,
          saved:JSON.parse(localStorage.getItem('11am-politics:reading-position-v2')).anchorId
        })""")
        assert resumed["focus"]=="ch05-sec03",resumed
        assert -50 < resumed["top"] < 760,resumed
        ctx.close()
        print("PASS: actual Chromium disk-profile restart retains exact section and resumes")

        # Prior-session revision checkpoints are never reduced to chapter
        # start just because the show/hide preference is off.
        hidden_profile=root/"hidden-profile"
        ctx,page=visit_with_profile(p,hidden_profile,url)
        page.evaluate("""([readingKey,prefKey]) => {
          localStorage.setItem(prefKey,'false');
          localStorage.setItem(readingKey,JSON.stringify({
            v:2,chapterId:'ch07',anchorId:'ch07-rev03',
            anchorFraction:.18,chapterFraction:.89,savedAt:Date.now()
          }));
        }""", [STORAGE_KEY,PREF_KEY])
        ctx.close()
        ctx,page=visit_with_profile(p,hidden_profile,url)
        expect(page.locator("#politicsContinuePrompt")).to_be_visible(timeout=10000)
        expect(page.locator("#politicsResumeNote")).to_be_visible()
        expect(page.locator("#politicsContinueDescription")).to_contain_text("Key Definitions")
        assert not page.locator("#politicsShowStudyMaterial").is_checked()
        assert page.locator("#ch07 .end-matter").evaluate(
            "el=>getComputedStyle(el).display"
        )=="none"
        page.locator("#politicsContinueButton").click()
        page.wait_for_function("() => location.hash==='#ch07-rev03'")
        assert page.locator("#ch07 .end-matter").evaluate(
            "el=>getComputedStyle(el).display"
        )!="none"
        assert not page.locator("#politicsShowStudyMaterial").is_checked()
        assert page.evaluate("key=>localStorage.getItem(key)",PREF_KEY)=="false"
        assert page.evaluate("document.activeElement.id")=="ch07-rev03"
        ctx.close()
        print("PASS: hidden saved revision reopens temporarily without changing user preference")

        # With service workers enabled, edition metadata must come from the
        # active installed worker and must be available without internet.
        browser=p.chromium.launch(headless=True)
        ctx=browser.new_context(
            viewport={"width": 1200, "height": 800}, service_workers="allow"
        )
        ctx.route(re.compile(r"^https://fonts\.(googleapis|gstatic)\.com/"),
                  lambda route:route.abort())
        page=ctx.new_page()
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(url,wait_until="domcontentloaded")
        page.wait_for_function("""() => /^[a-f0-9]{12}$/.test(
          document.querySelector('#politicsEditionVersion').textContent.trim()
        )""",timeout=20000)
        shown=page.locator("#politicsEditionVersion").inner_text()
        worker_revision=page.evaluate("""async()=>{
          const reg=await navigator.serviceWorker.ready;
          const active=navigator.serviceWorker.controller||reg.active;
          return new Promise((resolve,reject)=>{
            const channel=new MessageChannel();
            const timer=setTimeout(()=>reject(Error('Worker edition timeout')),4000);
            channel.port1.onmessage=e=>{
              clearTimeout(timer);channel.port1.close();resolve(e.data);
            };
            active.postMessage({type:'GET_EDITION'},[channel.port2]);
          });
        }""")
        assert worker_revision["type"]=="EDITION_STATUS",worker_revision
        assert worker_revision["revision"]==shown,(worker_revision,shown)
        page.wait_for_function(
            "() => document.querySelector('#offlineToggle').classList.contains('is-ready')"
        )
        compact=page.locator("#offlineToggle").bounding_box()
        assert compact["width"]<=40 and compact["height"]<=40,compact
        page.locator("#politicsNavFab").click()
        page.get_by_role("tab",name="Tools").click()
        expect(page.locator("#politicsCheckUpdates")).to_be_visible()
        expect(page.locator("#politicsEditionVersion")).to_have_text(shown)
        page.locator("#politicsCheckUpdates").click()
        page.wait_for_function("""() => /No newer edition found|A new edition is downloading/.test(
          document.querySelector('#politicsEditionStatus').textContent
        )""",timeout=10000)
        ctx.set_offline(True)
        page.locator("#politicsCheckUpdates").click()
        expect(page.locator("#politicsEditionStatus")).to_contain_text("You are offline")
        expect(page.locator("#politicsEditionVersion")).to_have_text(shown)
        assert not errors,errors
        ctx.close();browser.close()
        print("PASS: installed worker revision, manual check, offline feedback and compact status")
    finally:
      server.shutdown()
      server.server_close()

if __name__=="__main__":
    run()
