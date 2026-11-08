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
              if(document.querySelector('.p-search-result') !== null)
                throw new Error('Old search result still clickable while typing');
            }""")
            # The new query may render after debounce, but a *real* selection
            # must cancel it and keep the popover closed.
            expect(page.locator(".p-search-result").first).to_be_visible(timeout=15000)
            page.locator(".p-search-result").first.click()
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

            # Color is a semantic part of the guide: check all 20 chapter
            # banners, every TOC badge and all six callout categories.
            # Print must not silently replace ANY screen palette swatch.
            palette_script = """() => {
              const style = element => {
                const s = getComputedStyle(element);
                return [s.backgroundColor, s.backgroundImage, s.color];
              };
              return {
                chapters: Array.from(document.querySelectorAll('.chapter'),
                  c => style(c.querySelector('.chapter-tab'))),
                headings: Array.from(document.querySelectorAll('.chapter'),
                  c => style(c.querySelector('.chapter-tab h1'))),
                toc: Array.from(document.querySelectorAll('.toc-num'),style),
                tables: Array.from(document.querySelectorAll('.chapter thead th'),
                  style).slice(0,30),
                revisions: Array.from(document.querySelectorAll('.chapter .em-title'),
                  style).slice(0,30),
                callouts: ['def','concept','tip','mistake','memory','highyield']
                  .map(t=>style(document.querySelector('.box.'+t)))
              };
            }"""
            screen_palette = print_page.evaluate(palette_script)
            print_page.emulate_media(media="print")
            print_palette = print_page.evaluate(palette_script)
            assert print_palette == screen_palette, "Print changed the established color system"
            assert len(print_palette["chapters"]) == 20
            assert len({c[0] for c in print_palette["chapters"]}) == 20
            assert all("linear-gradient" in c[1] for c in print_palette["chapters"])
            assert len(print_palette["toc"]) == 20
            assert len(print_palette["callouts"]) == 6
            # Test a real cover -> legend -> multi-page TOC -> chapter sequence,
            # not just an isolated chapter. The cover must be genuinely
            # furniture-free; continuation TOC pages must retain their inset.
            front_page = context.new_page()
            front_page.goto(url, wait_until="domcontentloaded")
            front_page.emulate_media(media="print")
            insets = front_page.evaluate("""() => {
              const cover=getComputedStyle(document.querySelector('.cover'));
              const toc=getComputedStyle(document.querySelector('.toc-page'));
              const chapter=getComputedStyle(document.querySelector('#ch01'));
              const body=getComputedStyle(document.body);
              return {
                coverPage:cover.getPropertyValue('page'),
                tocPage:toc.getPropertyValue('page'),
                chapterPage:chapter.getPropertyValue('page'),
                tocBreak:toc.boxDecorationBreak,
                chapterBreak:chapter.boxDecorationBreak,
                tocTop:parseFloat(toc.paddingTop),
                bodyFont:parseFloat(body.fontSize)
              };
            }""")
            assert insets["coverPage"] == "politics-cover", insets
            assert insets["tocPage"] == "politics-front", insets
            assert insets["chapterPage"] == "politics-ch01", insets
            assert insets["tocBreak"] == "clone", insets
            assert insets["chapterBreak"] == "clone", insets
            assert insets["tocTop"] > 25, insets
            assert insets["bodyFont"] > 14.5, insets
            front_page.evaluate("""() => {
              const main=document.querySelector('#politicsMainContent');
              const chapter=document.querySelector('#ch01');
              const shortChapter=chapter.cloneNode(false);
              shortChapter.append(chapter.querySelector('.chapter-tab').cloneNode(true));
              main.replaceChildren(
                main.querySelector('.cover').cloneNode(true),
                main.querySelector('.legend-page').cloneNode(true),
                main.querySelector('#book-contents').cloneNode(true),
                shortChapter
              );
              document.body.replaceChildren(main);
            }""")
            for background in (False, True):
                pdf = front_page.pdf(
                    print_background=background, prefer_css_page_size=True
                )
                pages = PdfReader(io.BytesIO(pdf)).pages
                texts = [(page.extract_text() or "") for page in pages]
                assert len(pages) >= 3, (background, len(pages))
                assert "The Complete" in texts[0], texts[0][:800]
                assert "11AM · POLITICS" not in texts[0], texts[0][:800]
                assert "PREMIUM STUDY NOTES" not in texts[0], texts[0][:800]
                assert "POLITICAL SCIENCE" not in texts[0], texts[0][:800]
                assert "11AM · POLITICS" in texts[1], texts[1][:800]
                assert "PREMIUM STUDY NOTES" in texts[1], texts[1][:800]
                assert "Table of Contents" in "".join(texts[1:-1])
                assert "Multilevel Politics" in "".join(texts[1:-1])
                assert "01 · WHAT IS POLITICS?" in texts[-1], texts[-1][:800]
                assert "What is Politics?" in texts[-1], texts[-1][:800]
                print(f"PASS: cover without print furniture, TOC flow, "
                      f"chapter headers and legible type; background={background}")
            front_page.close()

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
              const printChoice = document.getElementById('politicsPrintStudyMaterial');
              printChoice.hidden = true;
              clone.append(printChoice);
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
                        image:style.backgroundImage, display:style.display};
              }
              return {tab:sample('.chapter-tab'), title:sample('.chapter-tab h1'),
                      table:sample('thead th'), revision:sample('.em-title'),
                      end:sample('.end-matter')};
            }""")
            white = "rgb(255, 255, 255)"
            assert styles["tab"]["background"] != white, styles
            assert "linear-gradient" in styles["tab"]["image"], styles
            assert styles["title"]["color"] == white, styles
            assert styles["revision"]["color"] == white, styles
            assert styles["revision"]["background"] == styles["tab"]["background"], styles
            assert styles["end"]["display"] != "none", styles
            if styles["table"]:
                assert styles["table"]["color"] == white, styles
                assert styles["table"]["background"] == styles["tab"]["background"], styles

            for background in (False, True):
                pdf = print_page.pdf(
                    print_background=background, prefer_css_page_size=True
                )
                assert len(pdf) > 3000
                reader = PdfReader(io.BytesIO(pdf))
                text = "\n".join((p.extract_text() or "") for p in reader.pages)
                assert "chapter summary" in text.casefold(), text[:800]
                assert "politics" in text.casefold(), text[:800]
                assert "11AM" in text, text[:800]
                assert "PREMIUM STUDY NOTES" in text, text[:800]
                assert "POLITICAL SCIENCE" in text, text[:800]
                assert "01 · WHAT IS POLITICS?" in text, text[:800]
                assert re.search(r"(?<!\d)1\s*/\s*\d+", text), text[:800]
                assert abs(float(reader.pages[0].mediabox.width)-595.28)<2
                assert abs(float(reader.pages[0].mediabox.height)-841.89)<2
                print(f"PASS: Chromium PDF background={background}, "
                      f"{len(reader.pages)} pages, included revision")

            # Native printing reads the independent print setting, not the
            # on-screen hide setting. The same text stays in the source DOM.
            print_page.evaluate("""() => {
              document.getElementById('politicsPrintStudyMaterial').checked = false;
              dispatchEvent(new Event('beforeprint'));
            }""")
            hidden = print_page.locator('.end-matter').evaluate(
                "el=>getComputedStyle(el).display"
            )
            assert hidden == "none", hidden
            for background in (False, True):
                pdf = print_page.pdf(
                    print_background=background, prefer_css_page_size=True
                )
                reader = PdfReader(io.BytesIO(pdf))
                text = "\n".join((p.extract_text() or "") for p in reader.pages)
                assert "chapter summary" not in text.casefold(), text[:800]
                assert "politics" in text.casefold(), text[:800]
                assert "01 · WHAT IS POLITICS?" in text, text[:800]
                assert "PREMIUM STUDY NOTES" in text, text[:800]
                print(f"PASS: Chromium PDF background={background}, "
                      f"{len(reader.pages)} pages, revision excluded")
            assert print_page.evaluate(
                "() => document.body.classList.contains('politics-hide-study-material')"
            ), "Print must not reset the reading preference"

            browser.close()
            print("PASS: 70+ navigable search results, exact-text highlighting, "
                  "debounce cancellation and stable blue rail")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    check()
