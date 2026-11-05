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

A floating **Contents** button opens a screen-only, accessible sidebar. Its six subject groups, 20 chapter rows, 140 in-chapter section links and 101 revision shortcuts are derived directly from the book. The final **Closing Note** has its own destination. Use the independent chevrons to expand chapters, the search field to find headings, and the progress bar to locate the current chapter. **Resume reading** saves only the most recent section ID in local browser storage; there is no account, tracking or server sync.

Section links follow the stable `#ch01-sec01` convention, and revision links use `#ch01-rev01`. The original chapter URLs `#ch01`–`#ch20` still work. Changes to the notes must preserve these IDs, or update relevant anchors deliberately.

The navigation lives in `navigation.js` and `navigation.css`, both included in the complete offline shell. The drawer and reading header are excluded from print; the original cover, table of contents and study guide remain printable.
