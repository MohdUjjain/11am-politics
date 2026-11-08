# 11AM Politics — Reader UI Design System

**Scope:** Screen-only reading header, contents drawer, search, study visibility, progress, and offline controls. The 20-chapter academic book and its print format are authoritative source content and must remain unchanged through UI-only revisions.

## Architecture and hierarchy

The original 920px parchment academic dossier uses Fraunces editorial headings, Source Sans 3 text, IBM Plex Mono metadata, and chapter-specific binder hues. These core tokens remain in index.html.

Reader controls in assets/css/navigation.css use the same palette: a parchment sticky header, a fixed blue whole-book rail, a chapter-color progress circle, a left modal Contents drawer with Index and Tools tabs, and an understated floating offline status. The Index contains chapter/section/revision links, Tools contains study visibility, offline version/update controls and Print / Save as PDF.

## Reader tokens — assets/css/navigation.css

| Token | Role |
|---|---|
| --p-ui-surface | White interactive surface (from --paper-card) |
| --p-ui-parchment | Parchment background (from --paper) |
| --p-ui-muted-surface | Quiet tab/footer background |
| --p-ui-hover | Hover color (from --blue-bg) |
| --p-ui-selected | Active navigation background |
| --p-ui-divider | Border (from --rule) |
| --p-ui-focus | Focus ring (from --blue) |
| --p-ui-text, --p-ui-text-soft | Ink hierarchy |
| --p-ui-radius, --p-ui-radius-sm | 8px and 6px control rounding |
| --p-ui-touch | Minimum 44px touch target |
| --p-ui-highlight | Search match gold |
| --p-ui-font | Source Sans 3 and system fallback |
| --p-ui-font-meta | IBM Plex Mono |
| --p-ui-font-editorial | Fraunces and Georgia |

Existing chapter --h variables drive each chapter's color ring. They never recolor the whole-book rail. Chapters 13 and 14 use darker screen-only header gradients to meet white-text contrast requirements.

## Screen and accessibility rules

At width 600px the header becomes compact and shows Ch. NN; at 520px the brand is hidden to preserve search room. The mobile search text is 16px to avoid iOS focus zoom. Fixed controls respect safe-area insets. Core tap controls are at least 44px.

Search uses an accessible combobox/listbox, keyboard arrows, Enter and Escape, incremental results and exact-term highlighting. The sidebar uses inert isolation and focus restoration, with an Index/Tools tablist and a shared Continue Reading footer. Reduced-motion preferences disable CSS smooth scrolling and navigation transitions. A skip link goes to the reading content.

Screen-only hiding applies to the entire chapter end-matter container. Direct revision links and a saved revision checkpoint may temporarily reveal the relevant chapter without changing the saved choice. The **separate print checkbox** in Tools → Export decides whether all 20 end-matter sections are included in print/PDF, regardless of the reading choice, and persists as `11am-politics:include-print-study-material-v1`. The `beforeprint` event also covers Ctrl/Cmd+P. After printing, the temporary print class is removed without altering reading mode.

The A4 page retains its original `14mm 13mm` margins; an `@page` parchment background paints the physical page canvas including margin strips (which the body background cannot reach). `print-color-adjust:exact` keeps the paper canvas in Chrome PDF output even with Background graphics disabled. Browser-supplied Headers and footers are controlled by the print dialog, not this stylesheet.

## Naming and persistence compatibility

Reader setting helper: assets/js/study-material-visibility.js, global PoliticsStudyMaterialVisibility. Checkbox: politicsShowStudyMaterial. Body class: politics-hide-study-material. Retire the old summary-only JavaScript, CSS and DOM names.

**Preserve these historical localStorage keys exactly:**

- 11am-politics:show-end-of-chapter-material-v2 — current persisted preference
- 11am-politics:show-chapter-summaries-v1 — migration fallback for older editions
- 11am-politics:reading-position-v2 — saved reading checkpoint

The service worker, offline readiness list and content-hash build must agree about the renamed helper. Build/revise the service worker via python scripts/build.py after changing any app-shell source.

## Browser and visual regression protocol

GitHub Actions checks structure, a fixed Git-blob SHA of the academic chapter source, preference migration, navigation, search, offline cache safety, and reading restoration across a real Chromium process restart.

The screenshot suite captures six UI states — cover, Index, Tools, search, mid-chapter reading and hidden study material — at four viewport sizes: 320x568, 390x844, 768x900 and 1440x900 CSS pixels. It also captures a print-mode chapter sample and PDF proofs with print backgrounds **on and off**. Each workflow uploads the captures and a JSON manifest through actions/upload-artifact, including when a regression fails.

Visual screenshots are reviewable artifacts, not fragile pixel-hash assertions. The test enforces geometry, no JavaScript errors, source preservation and print contrast; compare the images with the previous successful run when changing styles. External fonts are blocked in deterministic CI screenshots, so a real font-loaded device pass remains useful.

Local checks:

    python scripts/build.py --check
    python tests/verify_publication.py
    node tests/unit/test_study_material_visibility.mjs
    node tests/unit/test_consolidation.mjs
    node tests/unit/test_search.mjs
    node tests/unit/test_reading_position.mjs
    node tests/unit/test_service_worker.mjs
    python tests/browser/test_search_print.py
    python tests/browser/test_mobile_accessibility.py
    python tests/browser/test_reading_offline.py
    python tests/browser/test_visual_regression.py

Browser tests require Python playwright and pypdf plus Playwright Chromium. Generated artifacts/ should not be committed.

## Maintenance guardrails

- Preserve all original educational text, chapter IDs, and print layout.
- Keep offline updates atomic and the installed cache revision content-derived.
- Keep persistent storage independent of cache eviction and worker updates.
- Update CI expectations when renaming a control; verify both screen and print.
- Run narrow-mobile scenarios first for new interface additions.

## Repository layout

The deployed book entry point, service worker, manifest, 404 and sitemap remain at the repository root. Reader JavaScript lives under `assets/js/`; reader CSS is `assets/css/navigation.css`; icons and social preview assets live under `assets/icons/` and `assets/images/`. Build scripts, unit tests and browser tests remain under `scripts/`, `tests/unit/` and `tests/browser/` respectively. For the complete organization and safe-update procedure see [Architecture](architecture.md).
