# Changelog

All notable oncOS frontend releases are recorded here. Versions follow semantic versioning.

## [1.3.1] - 2026-08-08

### Fixed

- Touch devices no longer show card/row highlights while scrolling: hover
  tints are pointer-only, with :active press feedback on selection instead.
- Hub module icon tiles restored to the accent teal.

## [1.3.0] - 2026-08-08

### Changed

- Functional-teal design language: the five per-module wavelength accents are
  retired for one clinical-teal accent that strictly marks actionable elements
  (links, active tab and nav, focus, buttons); all static accents are slate,
  and colour otherwise belongs to clinical semantics (CTCAE grades, urgency,
  status). Wordmark "OS" and app icons in solid teal.
- One chip system suite-wide: a shared 20px pill geometry with two finishes
  (outline for categorical facts, soft fill for semantic ones) across Evidence
  phase, Staging system, Tox facet and Acute urgency chips, with fixed widths
  so chip columns align.
- Staging system chips carry the system name only (AJCC, FIGO, IASLC/UICC...);
  edition detail stays in its own column and the full label in the detail view.
- Evidence trial subtitles sentence-cased with acronyms preserved; phase chips
  neutral; balanced detail-card columns. Home cards carry module descriptors;
  the desktop masthead names the active module.
- Light-theme status colours deepened to clear the 4.5:1 small-text floor;
  Tox grade ramp rebased onto the status family; dark-theme raised surfaces
  gain an edge ring.

## [1.2.0] - 2026-07-19

### Added

- Persistent oncOS One shell with hub routing across Evidence, Staging, Drugs, Tox and Acute.
- Accessible module headings, native interactive controls, labelled filters and semantic table metadata.
- Drawer focus management, keyboard containment and state announcements.
- Sticky Evidence and Staging headers with safe-area support.
- Visible keyboard focus treatment and coarse-pointer touch targets.

### Fixed

- Navigation race handling and stale-view cancellation.
- Root service-worker coexistence with the retired Algorithms module.
- Error-response caching and root-relative PWA asset paths.
- Dynamic theme and search bindings across shell mounts.
- Evidence and Staging mouse-only navigation, sorting and row activation.

### Optimised

- Warm-view preparation and view-transition work.
- Light-theme muted-text contrast.
- Drugs heading hierarchy without altering card presentation.

### Verification

- Shell regression contracts passed.
- All five modules passed desktop and 390 px browser QA with no horizontal overflow.
- Protected production was verified after deployment with no console errors.
