#!/usr/bin/env python3
"""Chromium regression tests for Batch A: search, progress rail and print."""
from __future__ import annotations

import io
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def check():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/index.html"

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                service_workers="block",
            )
            # These tests must work without a connection to Google Fonts.
            context.route(re.compile(r"^https://fonts\.(googleapis|gstatic)\.com/"),
                          lambda route: route.abort())
            page = context.new_page()
            page_errors = []
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.querySelectorAll('.p-nav-group').length === 6"
            )
            input_box = page.locator("#politicsFullSearch")

            # The first page is bounded, but every later match remains reachable.
            input_box.fill("politics")
            expect(page.locator(".p-search-result").first).to_be_visible(timeout=15000)
            page.wait_for_timeout(150)
            assert page.locator(".p-search-result").count() == 35
            assert page.locator(".p-search-load-more").count() == 1
            page.locator(".p-search-load-more").click()
            assert page.locator(".p-search-result").count() == 70
            assert "Showing 70 of" in page.locator("#politicsSearchMeta").inner_text()

            # Click a real result, ensure the text itself is highlighted.
            page.locator(".p-search-result").nth(36).click()
            expect(page.locator("#politicsSearchPopover")).to_be_hidden()
            page.wait_for_function(
                "() => document.querySelectorAll('.p-search-hit').length === 1",
                timeout=5000,
            )
            assert not page_errors, page_errors
            highlighted = page.evaluate("""() => ({
              full: document.querySelectorAll('.p-search-hit').length,
              text: CSS.highlights?.get('politics-search-term')?.size || 0,
              fallback: document.querySelectorAll('mark.p-search-term').length
            })""")
            assert highlighted["full"] == 1, highlighted
            assert highlighted["text"] + highlighted["fallback"] > 0, highlighted

            # Simulate another search input immediately followed by a click.
            # Pending callbacks must never reopen a dismissed results panel.
            input_box.fill("sovereignty")
            expect(page.locator(".p-search-result").first).to_be_visible(timeout=15000)
            page.evaluate("""() => {
              const input = document.querySelector('#politicsFullSearch');
              input.value='political';
              input.dispatchEvent(new Event('input', {bubbles:true}));
              document.querySelector('.p-search-result').click();
            }""")
            page.wait_for_timeout(200)
            assert page.locator("#politicsSearchPopover").is_hidden(), (
                "A pending debounced search reopened the dismissed panel"
            )

            # The whole-book rail stays blue; chapter ring still takes its hue.
            page.locator("#ch08").scroll_into_view_if_needed()
            page.wait_for_timeout(150)
            rail = page.locator("#politicsReadingFill").evaluate(
                "el => getComputedStyle(el).backgroundColor"
            )
            assert rail == "rgb(31, 95, 139)", f"Book rail changed hue: {rail}"
            ring = page.locator("#politicsChapterProgress").evaluate(
                "el => el.style.getPropertyValue('--p-chapter-color')"
            )
            assert ring.startswith("hsl("), f"Chapter hue not populated: {ring}"

            # Test actual print media while study material is hidden on screen.
            print_page = context.new_page()
            print_page.goto(url, wait_until="domcontentloaded")
            print_page.evaluate("""() => {
              const chapter = document.querySelector('section.chapter');
              const sampleTable = document.querySelector('section.chapter table');
              const clone = chapter.cloneNode(false);
              clone.append(chapter.querySelector('.chapter-tab').cloneNode(true));
              const content = document.createElement('div');
              content.className = 'content';
              content.append(chapter.querySelector('.content h2').cloneNode(true));
              if (sampleTable) content.append(sampleTable.cloneNode(true));
              clone.append(content);
              const revision = document.createElement('div');
              revision.className = 'end-matter';
              revision.append(chapter.querySelector('.end-matter .em-title').cloneNode(true));
              revision.append(chapter.querySelector('.end-matter p').cloneNode(true));
              clone.append(revision);
              document.body.replaceChildren(clone);
              document.body.classList.add('politics-hide-study-material');
            }""")
            print_page.emulate_media(media="print")
            styles = print_page.evaluate("""() => {
              function sample(selector) {
                const element = document.querySelector(selector);
                if (!element) return null;
                const style = getComputedStyle(element);
                return {color:style.color, background:style.backgroundColor,
                        display:style.display};
              }
              return {tab:sample('.chapter-tab'), title:sample('.chapter-tab h1'),
                      table:sample('thead th'), revision:sample('.em-title'),
                      end:sample('.end-matter')};
            }""")
            expected = "rgb(32, 36, 44)"
            assert styles["tab"]["background"] == "rgb(255, 255, 255)", styles
            assert styles["title"]["color"] == expected, styles
            assert styles["revision"]["color"] == expected, styles
            assert styles["end"]["display"] != "none", styles
            if styles["table"]:
                assert styles["table"]["color"] == expected, styles
                assert styles["table"]["background"] == "rgb(255, 255, 255)", styles

            for background in (False, True):
                pdf = print_page.pdf(
                    print_background=background, prefer_css_page_size=True
                )
                assert len(pdf) > 3000
                reader = PdfReader(io.BytesIO(pdf))
                text = "\n".join((p.extract_text() or "") for p in reader.pages)
                assert "chapter summary" in text.casefold(), text[:800]
                assert "politics" in text.casefold(), text[:800]
                print(f"PASS: Chromium PDF background={background}, "
                      f"{len(reader.pages)} pages, visible text and revision")

            browser.close()
            print("PASS: 70+ navigable search results, exact-text highlighting, "
                  "debounce cancellation and stable blue rail")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    check()
