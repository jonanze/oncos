# Changelog

All notable oncOS frontend releases are recorded here. Versions follow semantic versioning.

## [1.4.0] - 2026-08-09

### Added

- **Notes** — a sixth module, the suite's narrative layer. Tumour-group
  landing cards open a group's notes; a note renders with a sticky section
  index, and search spans every note's title and section headings. Trial names
  in the prose link straight to the trial's row in Evidence, and claims carried
  over from the source notes but not yet independently verified carry a small
  YX provenance badge.

## [1.3.9] - 2026-08-08

### Changed

- Acute drops its urgency grading display entirely: no urgency column, pills,
  or drawer dots. The underlying data field remains unrendered.

## [1.3.8] - 2026-08-08

### Fixed

- Sliding module indicator is pixel-exact with the tab it marks: stray drawer
  padding had widened the tabs to 40px under a 36px pill, and the pill now
  sizes itself from the live tab box.

## [1.3.7] - 2026-08-08

### Fixed

- Sliding module indicator no longer doubles with a static tint on the active
  tab; search field shows a single border on focus (ring removed).

### Changed

- Tox landing card titles use the launcher's tracked-uppercase label style.

## [1.3.6] - 2026-08-08

### Changed

- Beautification set: the masthead's active-module pill glides between tabs;
  the search field blooms wider on focus; section labels carry a trailing
  hairline suite-wide; dark mode gains a faint top glow and a machined edge
  on raised cards. Tox landing cards are titles only (counts removed).

## [1.3.5] - 2026-08-08

### Changed

- Hub and Tox landing cards drop their descriptor lines; Tox keeps the counts.

### Fixed

- Sign-in page synced to the functional-teal identity (it still carried the
  retired wordmark gradient and iris accent).
- Masthead module tabs no longer touch the search field in the 885-905px band.
- Evidence UPDATE tag aligned to the chip system's type metrics.

## [1.3.4] - 2026-08-08

### Changed

- Evidence uses desktop width: the trial table widens to 1280px (subtitles on
  one line, shorter rows), and on wide screens the trial card becomes a
  two-column composition -- Key findings as a reading column beside a rail of
  Population, Treatment arms, Endpoint and Reference.

## [1.3.3] - 2026-08-08

### Fixed

- Mobile stage tables no longer overflow when the stage column carries entity
  names instead of short codes (Adult diffuse glioma, appendiceal carcinoma)
  or unbreakable slash-joined definitions (lung): the column may wrap under
  640px, long tokens break, and stage blocks scroll as a seatbelt.
- Evidence detail cards regained their long-token wrap guard on phones (the
  rule had rotted onto a selector no longer in the markup).

## [1.3.2] - 2026-08-08

### Fixed

- Touch press feedback rebuilt: the native grey tap-highlight is disabled, and
  highlights are driven by press intent — they appear only after a brief still
  press (or on tap release), never while scrolling, land instantly and fade
  out softly; cards compress slightly while pressed.

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
