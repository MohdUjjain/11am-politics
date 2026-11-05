# 11AM — Politics Complete Study Notes

**Read and install:** https://mohdujjain.github.io/11am-politics/

This repository publishes the uploaded **Politics: The Complete Premium Study Notes & Revision Guide** as a single, installable and offline-capable GitHub Pages website. All 20 chapters, study tables, revision sheets and exam questions remain in the one-page `index.html`. The PWA additions do not rewrite the academic content.

## One-time GitHub Pages activation

Open this repository's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, then select **Save**. GitHub will publish `index.html` at the address above. Further commits to main deploy automatically.

## Install and read without internet

1. Visit the public site once **while online**. Allow the page to load.
2. Tap the small **Saving offline…** control in the lower-right corner; wait until it says **Available offline**. The service worker has then cached the entire 20-chapter HTML file, the app script, manifest, and both icons.
3. On Android Chrome or desktop Chrome/Edge choose the browser's **Install app** option (or the in-page Install button if offered). On iPhone/iPad, use **Safari → Share → Add to Home Screen**.
4. Reopen the installed app without Wi-Fi or mobile data. Every chapter, table, and internal section link remains available.
5. Tap **Available offline → Keep on this device** to *request* persistent browser storage for longer retention. Browsers may grant or decline.

**Important:** Browser offline data is not guaranteed permanent. Device storage management, uninstalling, or clearing site data can remove it. Persistent storage reduces the risk of automatic eviction; it cannot override manual deletion or every OS storage policy.

## Updated editions

The service worker opens the cached book immediately, even when offline. When a reader returns online, it checks whether `index.html` has changed, saves the **complete** replacement, then shows **New edition ready**. The reader can choose **Reload updated guide**.

The original Google Fonts references remain. The worker also saves the fonts used in online sessions when possible. If a particular font isn't available offline, the browser substitutes a local fallback, but **all book content remains accessible**.

If editing app scripts/icons rather than just the text, change the `BOOK_CACHE` identifier in `service-worker.js` to force a new atomic app-shell pre-cache.

## File structure

- `index.html`: complete one-page book and unobtrusive install/offline controls
- `service-worker.js`: offline cache, font caching and background edition refresh
- `offline.js`: offline status, installation and persistent-storage controls
- `manifest.webmanifest` and `icons/`: installable PWA metadata and icons
- `404.html`: custom missing-page fallback
- `sitemap.xml`: one-page canonical sitemap
- `.nojekyll`: serve static HTML unchanged

## Testing

After Pages is enabled, visit the site online and wait for **Available offline**. On desktop, use Chrome DevTools → Application → Service Workers/Cache Storage, then switch Network to **Offline** and reload. On a phone, launch the installed app in airplane mode. If the browser doesn't offer installation, use its menu's **Add to Home Screen** option.

## Publishing checklist
- After editing any published file, run `python scripts/build.py` to regenerate the content-hashed service worker.
- Validate with `python scripts/build.py --check`, `python tests/verify_publication.py` and `node tests/test_service_worker.mjs`.
- Commit `index.html`, the regenerated `service-worker.js` and any changed public assets together; GitHub Pages publishes from `main` / `(root)`.
- The GitHub Actions verification workflow reports problems but does not itself block a branch-based Pages deployment.
- Open the site online, confirm `Available offline`, install it, then test reopening in airplane mode. After a new edition goes live, reopen online and use `Reload updated guide` when prompted.
- Social sharing uses the public 1200×630 `og-image.png`, which some messaging apps may cache independently.
- `robots.txt` at `/11am-politics/robots.txt` would not control crawlers at the origin root; the canonical URL and sitemap are the useful project-site metadata here.

## Collapsible reading navigation

A floating **Contents** button opens a two-tab, accessible sidebar. **Index** holds the six subject groups, 20 chapter rows, 140 section links and 101 revision shortcuts, with expand/collapse controls. **Tools** holds the saved end-of-chapter visibility switch and a **Print / Save as PDF** action. The shared **Continue Reading** button is available from either tab. The cover and printed-contents shortcuts have been removed. The final **Closing Note** retains its index destination. **Resume reading** saves only the most recent section ID in local browser storage; there is no account, tracking or server sync.

Section links follow the stable `#ch01-sec01` convention, and revision links use `#ch01-rev01`. The original chapter URLs `#ch01`–`#ch20` still work. Changes to the notes must preserve these IDs, or update relevant anchors deliberately.

The navigation lives in `navigation.js` and `navigation.css`, both included in the complete offline shell. The drawer and reading header are excluded from print; the original cover, table of contents and study guide remain printable.

## On-device reading checkpoint and two progress indicators

The thin **book progress rail** spans the complete document. The separate **circular chapter indicator** displays progress within the active chapter, using that chapter's accent color. The sticky header has a parchment background, dark ink text, and the book's blue progress rail.

The browser saves `chapterId`, `anchorId`, a **fraction of the current section**, a **fraction of the chapter**, and a timestamp in `localStorage` under `11am-politics:reading-position-v2`. The last section ID from earlier installed releases is automatically migrated. Saving occurs during reading and on page visibility changes / page closure, without syncing or tracking. Cached editions do not clear local storage. If a heading is missing in a newer edition, the chapter fraction is used as a fallback.

On a subsequent visit to the cover without a direct `#section` URL, a **Continue reading?** card offers **Continue reading** or **Not now**. No automatic scroll jump is performed. The drawer's **Continue** button offers the same explicit action. A direct bookmarked section URL still opens that section normally.

Local storage may be lost if the device or browser clears site data, evicts browser storage, or launches in a private browsing session. Position restoration is approximate after typography changes or major content edits; the chapter and section identities remain the primary anchors.

## Reader option: Show End-of-Chapter Study Material

The existing sidebar checkbox now controls **all end-of-chapter study material** with one action. It is **enabled by default**. Unchecking **Show End-of-Chapter Study Material** hides each chapter's entire `.end-matter` section on screen: **Chapter Summary**, **One-Page Revision Sheet**, **Key Definitions**, **Memory Aids**, **Possible Examination Questions**, and any extra review material (including Chapter 7's philosophers table). The 20 main chapter texts and 140 section links are unaffected.

The contents drawer also hides all revision shortcuts and their "Revision & Recall" label while the setting is off. Re-check the box to show them again. The switch is persisted in `localStorage` under `11am-politics:show-end-of-chapter-material-v2`, and an existing `show-chapter-summaries-v1` preference is migrated. It survives installed app relaunching and updates so long as browser site data remains.

Deep links to a specific `#chXX-revYY` destination temporarily show that chapter's revision material even if the general setting is off. Clicking the checkbox to hide again immediately restores the hidden view. The preference is **screen-only**; printing/PDF export always includes the full notes. The original book content and revision headings are unchanged.

## Full-text header search and simplified sidebar (current)

The sticky parchment header now contains a **Search all notes** field. Search reads **the actual book text** from all 20 chapters, including body paragraphs, lists, tables, definitions, callouts, subheadings, and end-of-chapter study material (even when hidden from normal reading). No external service or network connection is used, and the search JavaScript is included in the offline PWA cache. The result list shows a chapter, contextual heading, and excerpt for each matching passage (up to 65 visible at once). Clicking a result jumps directly to the matching passage and outlines it; if the result is inside hidden revision material, that chapter's revision section is temporarily revealed without changing the saved preference. Press **/** outside a text field to focus search, use **↓** to move through results, **Enter** to open, and **Esc** to dismiss.

The sidebar now has an **Index** tab (chapter tree, expand/collapse controls) and a **Tools** tab (show/hide end-of-chapter material and browser Print / Save as PDF). The **Continue Reading** control remains in the shared footer, so it works on both tabs. Tab buttons support arrow-key switching. The redundant **Cover** and **Printed contents** sidebar links are removed; the original book pages themselves are untouched. The old sidebar title-only search was removed.

## Batch A — search correctness and print-safe output

Search now cancels pending debounced callbacks whenever results are selected, dismissed or the sidebar is opened. The first **35** matching passages display immediately; **Show more results** appends additional batches until all matching passages are available (there is no arbitrary 65-result ceiling). Selecting a match highlights the *exact matching word(s) inside the original passage* using the CSS Custom Highlight API, with a markup-based fallback for browsers that lack it. Inline academic emphasis, links, and other note formatting remain intact.

The thin **whole-book rail** remains the same book-blue (`#1F5F8B`) across every chapter; only the chapter circle uses a chapter-specific hue.

The print CSS now has a deliberate high-contrast, paper-white treatment for chapter banners, table headings, revision title badges, and printed table-of-contents numbers. This prevents white text from disappearing when browsers omit background graphics. The screen version keeps all of the original colored chapter styling. Printing continues to include the complete study guide and revision material even when that material has been hidden on screen.

GitHub Actions now includes a Chromium browser regression covering incremental search results, term highlighting, dismissal races, chapter-rail color, and **PDF rendering with both background graphics disabled and enabled**. Run locally with `python tests/test_browser_batch_a.py` after installing the Python `playwright` and `pypdf` packages and the Chromium browser.
