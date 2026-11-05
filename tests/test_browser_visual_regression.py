#!/usr/bin/env python3
"""Batch D: browser-interaction and visual evidence at phone/tablet/desktop widths.

Captured evidence is uploaded by GitHub Actions; it is intentionally not used as
a brittle image-hash golden test. Geometry, visibility and print invariants fail
the build, and screenshots provide human-reviewable visual regression evidence.
"""
from __future__ import annotations

import io
import json
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "politics-visual-regression"
OUT.mkdir(parents=True, exist_ok=True)
BREAKPOINTS = ((320, 568), (390, 844), (768, 900), (1440, 900))
STATES = ("cover", "index", "tools", "search", "reading", "study-hidden")


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def capture(page, name):
    filename = OUT / (name + ".png")
    page.screenshot(path=str(filename), full_page=False, animations="disabled")
    assert filename.stat().st_size > 1500, filename
    return filename.name


def geometry_check(page, width, state):
    dimensions = page.evaluate("""() => ({
        width:innerWidth,
        documentWidth:document.documentElement.scrollWidth,
        menu:(()=>{let r=document.querySelector('#politicsNavFab').getBoundingClientRect();
          return {left:r.left,right:r.right}})(),
        search:(()=>{let r=document.querySelector('#politicsFullSearch').getBoundingClientRect();
          return {left:r.left,right:r.right,width:r.width}})(),
        chapter:(()=>{let r=document.querySelector('#politicsChapterProgress').getBoundingClientRect();
          return {left:r.left,right:r.right}})(),
        dialog:(()=>{let r=document.querySelector('#politicsNavPanel').getBoundingClientRect();
          return {left:r.left,right:r.right}})(),
        results:(()=>{let r=document.querySelector('#politicsSearchPopover').getBoundingClientRect();
          return {left:r.left,right:r.right}})()
    })""")
    assert dimensions["width"] == width, (state, dimensions)
    assert dimensions["menu"]["left"] >= -1, (state, dimensions)
    assert dimensions["search"]["width"] >= 100, (state, dimensions)
    assert dimensions["search"]["right"] <= width + 1, (state, dimensions)
    assert dimensions["chapter"]["right"] <= width + 1, (state, dimensions)
    if state in ("index", "tools"):
        assert dimensions["dialog"]["left"] >= -1, (state, dimensions)
        assert dimensions["dialog"]["right"] <= width + 1, (state, dimensions)
    if state == "search":
        assert dimensions["results"]["left"] >= -1, (state, dimensions)
        assert dimensions["results"]["right"] <= width + 1, (state, dimensions)


def run():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/index.html"
    manifest = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for width, height in BREAKPOINTS:
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                    service_workers="block",
                    reduced_motion="reduce",
                )
                context.route(
                    re.compile(r"^https://fonts\.(googleapis|gstatic)\.com/"),
                    lambda route: route.abort(),
                )
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_function(
                    "() => document.querySelectorAll('section.chapter').length === 20"
                    " && document.querySelectorAll('.p-nav-chapter').length === 20"
                )
                page.evaluate("() => scrollTo({top:0,behavior:'instant'})")
                prefix = f"{width}x{height}"
                for state in STATES:
                    if state == "cover":
                        expect(page.locator("#politicsContinuePrompt")).to_be_hidden()
                        expect(page.locator("#politicsNavPanel")).to_be_hidden()
                    elif state == "index":
                        page.locator("#politicsNavFab").click()
                        expect(page.get_by_role("tabpanel", name="Index")).to_be_visible()
                    elif state == "tools":
                        page.get_by_role("tab", name="Tools").click()
                        expect(page.locator("#politicsShowStudyMaterial")).to_be_visible()
                        expect(page.locator("#politicsCheckUpdates")).to_be_visible()
                    elif state == "search":
                        page.locator("#politicsNavClose").click()
                        page.locator("#politicsFullSearch").fill("sovereignty")
                        expect(page.get_by_role("listbox").get_by_role("option").first
                               ).to_be_visible(timeout=15000)
                    elif state == "reading":
                        page.locator("#politicsSearchClose").click()
                        page.evaluate("""() => {
                          let el=document.querySelector('#ch07-sec02');
                          scrollTo({top:el.getBoundingClientRect().top+scrollY-100,
                                    behavior:'instant'});
                        }""")
                        expect(page.locator("#politicsCompactChapter")).to_have_text(
                            "Ch. 07"
                        ) if width <= 600 else None
                    elif state == "study-hidden":
                        page.locator("#politicsNavFab").click()
                        page.get_by_role("tab", name="Tools").click()
                        page.locator("#politicsShowStudyMaterial").uncheck()
                        assert page.locator("#ch07 .end-matter").evaluate(
                            "el=>getComputedStyle(el).display"
                        ) == "none"
                    geometry_check(page, width, state)
                    image_name = capture(page, f"{prefix}-{state}")
                    manifest.append({
                        "width": width, "height": height, "state": state,
                        "image": image_name
                    })
                assert not errors, (width, errors)
                context.close()
                print(f"PASS: {prefix} cover, Index, Tools, search, reading, hidden study material")

            # A deterministic small-print fixture uses the real book's chapter
            # DOM and the same print CSS as the complete book.
            context = browser.new_context(
                viewport={"width": 1100, "height": 900},
                service_workers="block", reduced_motion="reduce"
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded")
            page.evaluate("""() => {
              const chapter=document.querySelector('#ch07');
              const clone=chapter.cloneNode(false);
              clone.append(chapter.querySelector('.chapter-tab').cloneNode(true));
              const content=document.createElement('div');
              content.className='content';
              content.append(chapter.querySelector('.content h2').cloneNode(true));
              const table=chapter.querySelector('table');
              if(table)content.append(table.cloneNode(true));
              clone.append(content);
              const revision=document.createElement('div');
              revision.className='end-matter';
              revision.append(chapter.querySelector('.end-matter .em-title').cloneNode(true));
              revision.append(chapter.querySelector('.end-matter p').cloneNode(true));
              clone.append(revision);
              document.body.replaceChildren(clone);
              document.body.classList.add('politics-hide-study-material');
            }""")
            page.emulate_media(media="print")
            contrast = page.evaluate("""() => {
              const c=el=>getComputedStyle(document.querySelector(el));
              return {
                banner:c('.chapter-tab').backgroundColor,
                title:c('.chapter-tab h1').color,
                revision:c('.em-title').color,
                shown:c('.end-matter').display
              };
            }""")
            assert contrast == {
                "banner": "rgb(255, 255, 255)",
                "title": "rgb(32, 36, 44)",
                "revision": "rgb(32, 36, 44)",
                "shown": "block",
            }, contrast
            print_image = capture(page, "print-chapter-07")
            manifest.append({"state": "print-preview", "image": print_image})
            for background in (False, True):
                pdf = page.pdf(print_background=background, prefer_css_page_size=True)
                doc = PdfReader(io.BytesIO(pdf))
                extracted = "\n".join(x.extract_text() or "" for x in doc.pages).casefold()
                assert "chapter summary" in extracted and "politics" in extracted
                filename = OUT / f"print-background-{'on' if background else 'off'}.pdf"
                filename.write_bytes(pdf)
                assert filename.stat().st_size > 3000
                manifest.append({
                    "state": f"print-background-{'on' if background else 'off'}",
                    "file": filename.name, "pages": len(doc.pages)
                })
                print(f"PASS: print_background={background}, "
                      f"{len(doc.pages)} pages, chapter title and revision text")
            context.close()
            browser.close()

        (OUT / "manifest.json").write_text(
            json.dumps({"breakpoints": BREAKPOINTS, "states": STATES,
                        "captures": manifest}, indent=2) + "\n",
            encoding="utf-8"
        )
        assert len([x for x in manifest if "image" in x]) == len(BREAKPOINTS)*len(STATES)+1
        print(f"PASS: {len(manifest)} captured visual/print artifacts")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    run()
