# 11AM Politics

[Open the study guide](https://mohdujjain.github.io/11am-politics/) · [GitHub Pages](https://github.com/MohdUjjain/11am-politics/settings/pages)

An installable, offline-capable **20-chapter political science study guide**, published as a static GitHub Pages project. It has a full-text search, chapter/section index, reading-progress indicators, saved reading position, end-of-chapter study-material toggle, and print/PDF support with an independent revision-material option and full-page parchment canvas.

## Repository layout

```text
11am-politics/
├── index.html                     # The complete book + the Pages entry point
├── manifest.webmanifest           # Installable PWA metadata
├── service-worker.js              # Generated offline worker (keep at root for scope)
├── 404.html                       # GitHub Pages error page
├── sitemap.xml                    # Search discovery
├── assets/
│   ├── css/
│   │   └── navigation.css         # Screen-only reader controls and design tokens
│   ├── js/
│   │   ├── navigation.js          # Contents drawer, progress, resume integration
│   │   ├── search.js              # Full-text search and passage highlighting
│   │   ├── reading-position.js    # Saved reading checkpoint
│   │   ├── study-material-visibility.js
│   │   └── offline.js             # PWA installation, edition, updates
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── favicon-16.png
│   │   └── favicon-32.png
│   └── images/
│       └── og-image.png           # Landscape link-sharing preview
├── scripts/
│   ├── build.py                   # Deterministic worker / cache revision generator
│   └── service-worker.template.js
├── tests/
│   ├── verify_publication.py      # Structural, links, metadata and asset integrity
│   ├── unit/                      # Node tests for search, settings, checkpoints, PWA
│   └── browser/                   # Chromium interactions, mobile and visual regression
├── docs/
│   ├── architecture.md            # Hosting, paths, builds and offline constraints
│   └── reader-design-system.md    # Colors, typography, layout and UX guidelines
└── .github/workflows/
    └── verify-pages.yml
```

**Only deployment entry points belong at the root.** GitHub Pages reads `index.html` directly; the service worker stays at `/11am-politics/service-worker.js` to control the entire guide. The original academic chapter text and print CSS remain inside `index.html` deliberately, so this repository needs no bundler, app framework or server.

## Working on the site

The book's academic HTML and chapter IDs are immutable for interface-only improvements. New controls belong in `assets/js/` and `assets/css/`; site-wide assets belong in `assets/icons/` and `assets/images/`. Test changes against the original chapter hash, internal anchors and print output.

After **every** change to the HTML, worker template or cached asset, regenerate the service worker:

```bash
python scripts/build.py
python scripts/build.py --check
python tests/verify_publication.py
```

Then run the unit tests:

```bash
node tests/unit/test_search.mjs
node tests/unit/test_reading_position.mjs
node tests/unit/test_study_material_visibility.mjs
node tests/unit/test_service_worker.mjs
node tests/unit/test_consolidation.mjs
```

For browser checks, install Python `playwright` and `pypdf` plus Playwright Chromium:

```bash
python tests/browser/test_search_print.py
python tests/browser/test_mobile_accessibility.py
python tests/browser/test_reading_offline.py
python tests/browser/test_visual_regression.py
```

The visible on-return **Continue Reading** prompt is a dismissible floating notice below the reader header, not a card hidden within the cover. A newly ready offline edition uses the same notice space and takes priority, offering **Reload updated guide** or **Later**. Neither action automatically changes the saved reading position; dismissal is session-only. The edition and Resume notices cannot overlap. The prompt never prints, closes while Contents is open, and retains keyboard-accessible controls.

The dedicated browser regression `python tests/browser/test_reader_notice_priority.py` verifies this at 320, 390 and 1280px, including keyboard focus, competing updates, modal behavior and print exclusion.

The visual test produces screenshots at 320, 390, 768 and 1440 CSS-pixel widths and print PDFs with backgrounds on/off. GitHub Actions uploads the evidence as `politics-reader-visual-regression` (14-day retention). The workflow runs the full suite for pushes and pull requests.

## Deployment

This is a **GitHub Pages project site** using the `main` branch and `/(root)`. The public URL remains:

**https://mohdujjain.github.io/11am-politics/**

The cache ID is automatically derived from hashes of all listed sources in `scripts/build.py`. New editions are precached atomically before activating, while the reader's position and preferences remain in local browser storage. Do not rename the saved localStorage keys. Older offline clients are supported via the existing service-worker update mechanism.

For implementation details and constraints, see [Architecture](docs/architecture.md) and [Reader design system](docs/reader-design-system.md).

## Integrity guarantees

- The 20 chapters, their 140 section anchors and 101 revision anchors are preserved.
- All end-of-chapter material appears in printed/PDF output, even when hidden on screen.
- The search, tabs, reading resume and offline update controls remain available.
- The site uses its own PWA cache scope and does not delete other 11AM apps' caches.
- Browser storage may be evicted by the browser or device; offline data is not guaranteed permanently.
