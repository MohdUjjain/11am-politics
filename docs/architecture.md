# Architecture and publication rules

## Hosting and public paths

11AM Politics is a single-document, static Progressive Web App served at:

`https://mohdujjain.github.io/11am-politics/`

The repository is configured for GitHub Pages from the `main` branch root. **Keep these files at the repository root**:

- `index.html`: the entry point, complete 20-chapter academic book and original print CSS.
- `manifest.webmanifest`: browser installation metadata.
- `service-worker.js`: generated root-scope offline worker.
- `404.html`: route fallback for unknown Pages URLs.
- `sitemap.xml`: public index.

Also retain `.nojekyll` to prevent Jekyll transformations. Developer sources are in `scripts/`; they are not runtime entry points.

## Static assets

`assets/js/` contains the reader's distinct browser capabilities:
- `navigation.js`: index, tabs, progress, reading resume and preferences.
- `search.js`: full-text search and passage highlights.
- `reading-position.js`: saved reading position normalization and migration.
- `study-material-visibility.js`: end-of-chapter toggle and migrated preference.
- `offline.js`: registration, installation, edition status and manual updates.

`assets/css/navigation.css` contains the **screen-only** reader UI and tokens. `assets/icons/` contains installation and favicon sizes. `assets/images/` contains the 1200×630 Open Graph image.

Internal links and deep links remain `#ch01` … `#ch20`, `#chXX-secYY` and `#chXX-revYY`; moving assets does not rename anchors or change the guide URL.

## Deterministic edition / PWA lifecycle

`scripts/build.py` lists the cached shell assets and creates a 12-character revision from their Git-blob hashes and the service-worker template. The generated `service-worker.js` must be committed alongside every change to any of its sources.

The active worker caches **every required shell resource** in one installation transaction. If one file fails to download, the new worker must not activate. Its scope is confined to `/11am-politics/`; other 11AM applications' caches are untouched. The worker serves the complete cached guide for offline navigation, including all 20 chapters.

The same asset paths must match across: HTML links/scripts, PWA manifest, `offline.js` ESSENTIALS, service-worker SHELL, `scripts/build.py` SOURCES, and `tests/verify_publication.py` ASSETS. Do not move any asset without updating every one of these references.

### Migration from flat root assets

The November 2026 repository cleanup moved formerly top-level JavaScript/CSS files under `assets/js/` and `assets/css/`, moved the two install icons into `assets/icons/`, and moved the two favicons and social image to their corresponding asset folders. These are **file organization changes**, not a redesign or a preference reset.

An old offline installation keeps its previously cached HTML and scripts until the updated service worker installs its complete new shell. New editions use the updated paths. Browser-held localStorage keys remain the same.

## Testing structure

`tests/verify_publication.py` checks all internal anchors, source chapter counts, social metadata, PWA assets, cache listings and local files.

`tests/unit/` contains Node.js checks for reader preferences, checkpoint normalization, search, atomic service-worker installation and a frozen Git-blob hash of the original 20 chapters. Do not update the frozen hash merely to make a test pass: any legitimate academic content revision needs explicit review.

`tests/browser/` contains:
- `test_search_print.py`: search interactions and PDF contrast.
- `test_mobile_accessibility.py`: screen widths, keyboard and focus.
- `test_reading_offline.py`: real Chromium restarts, saved revisions, edition checks.
- `test_visual_regression.py`: screenshots of six UI states at four widths and print evidence.

`.github/workflows/verify-pages.yml` runs all of these and uploads the screenshot/PDF evidence. Visual captures are inspection artifacts; they are not pixel-hash snapshots. Real device testing is useful for installed PWA behavior on Android/iOS.

## Safe publishing checklist

1. Confirm the academic chapters and their IDs were not altered by interface work.
2. Update all relative paths when adding or moving assets.
3. Regenerate the service worker: `python scripts/build.py`.
4. Run structure and unit tests, then browser tests where available.
5. Commit and push the generated worker with the source changes.
6. Check the verification and Pages deployment workflows both succeeded.
7. When testing a previously installed PWA, use its **Check for updates / Reload updated edition** controls rather than erasing local site storage.

The original printed book is a deliberately separate presentation: reader chrome disappears under print media and hidden study sections remain included.
