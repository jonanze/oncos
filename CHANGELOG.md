# Changelog

All notable oncOS frontend releases are recorded here. Versions follow semantic versioning.

## [1.5.14] - 2026-08-31

- Published the independently curated Nasopharyngeal Carcinoma Evidence sheet.
- Replaced the governed population, treatment-arm, endpoint and key-finding cells across 17 rows from 21 independently accepted source-bound dossiers plus one claim-scoped source limit.
- Preserved all source links, other Evidence sheets and non-Evidence modules.

## [1.5.13] - 2026-08-30

- Published the independently curated Bladder & UTUC Evidence sheet.
- Replaced the governed population, treatment-arm, endpoint and key-finding cells across 21 rows from 25 independently accepted source-bound dossiers.
- Preserved all source links, non-Bladder modules and unrelated concurrent workbook changes.

## [1.5.12] - 2026-08-30

- Published the independently curated Advanced & Locoregional HCC Evidence sheet.
- Replaced all governed population, treatment-arm, endpoint and key-finding cells from verified source-bound dossiers while preserving formal source-limit rows.
- Kept unrelated oncOS modules and user-owned shared-checkout changes outside the release.

## [1.5.10] - 2026-08-25

- Replaced the five Breast Notes chapters with the evidence-first, independently
  accepted editions covering histopathology, DCIS, early, neoadjuvant, and
  metastatic breast cancer.
- Preserved exclusive teaching ownership across the Breast suite and the exact
  canonical Google Docs-to-cache round trip for all five chapters.
- Published the completed Breast endpoint-register and evidence-curation work
  through the Notes layer without changing unrelated suite content.

## [1.5.9] - 2026-08-16

- Replaced the three lymphoma Notes chapters with the revised DLBCL, Hodgkin
  lymphoma, and indolent non-Hodgkin lymphoma editions.
- Preserved the failed Evidence-entry and whole-suite findings as an explicit
  force-release exception; publication does not convert those gates to PASS.
- Corrected the Google Docs writer so cache frontmatter is not inserted into
  canonical Docs and inherited paragraph-list formatting is cleared.

## [1.5.8] - 2026-08-14

- Restored the complete NLST and NELSON screening evidence to the Early and
  locally advanced NSCLC note, its canonical reader-facing home.
- Correctly attached NELSON's primary male analysis, exploratory women's
  analysis, and male-cohort CT-screening operating characteristics.
- Preserved single ownership across the Lung suite: Classification retains only
  its screening bridge, with no duplicated screening evidence section.

## [1.5.7] - 2026-08-14

- Standardized sibling-list presentation across all 17 Notes: each semantic
  group now uses ordinary bullets or evidence blocks consistently, never both.
- Preserved ordered versus unordered semantics across direct transitions, blank
  paragraphs and invisible figure markers, with suite-wide regression coverage.
- Kept every visible clinical token, section, link and citation unchanged while
  reducing 87 mixed visual list groups to zero.

## [1.5.6] - 2026-08-14

- Replaced the Notes pill-matrix navigation with a restrained nested desktop
  outline and an accessible in-flow mobile outline.
- Restored semantic multi-row tables and continuous numbered lists, with
  container-local overflow for wide tables on small screens.
- Increased article typography and heading hierarchy, constrained the reading
  measure, and rendered long evidence units as readable prose blocks.
- Corrected scroll-spy behavior so the active section, including terminal
  References, remains visible and announced across desktop and mobile.

## [1.5.5] - 2026-08-14

- Reorganized SCLC into decision-led evidence blocks and concise lists without
  changing its independently accepted clinical claims, figures or citations.
- Removed cross-note Lung duplication: Early/locally advanced now owns screening,
  Classification owns staging and structural interpretation, and Metastatic owns
  treatment outcomes.
- Improved long-note readability with a centred desktop reading measure and
  left-aligned, non-hyphenated mobile prose.

## [1.5.4] - 2026-08-14

- Rebuilt the metastatic NSCLC and SCLC Notes from the complete applied Lung
  evidence layer, with independent clinical QA and exact Google Docs round-trips.
- Added the evidence-bound small-cell transformation section from Marcoux et al.
  and restored the eight previously blocked SCLC studies after governed intake.
- Kept HARMONi withheld because no accessible primary publication and accepted
  dossier chain were available.

## [1.5.3] - 2026-08-12

- Moved authoritative external citations in all four colorectal Notes—including
  Molecular—out of running prose and into numbered bibliography superscripts.
- Deduplicated repeated exact source URLs to one bibliography entry and number;
  the six ESMO metastatic-guideline citations now resolve to a single entry.
- Added lossless external-reference Google Docs round-tripping and deterministic
  release checks that reject pasted citation-only linked labels.

## [1.5.2] - 2026-08-12

- Corrected colorectal Notes citation presentation so long author, protocol and
  comparison identities render as numbered bibliography superscripts instead of
  interrupting the clinical prose.
- Preserved every clinical claim, number, qualifier, trial identity and external
  reference through independent QA and exact canonical-Doc/cache round-trips.

## [1.5.1] - 2026-08-12

- Rebuilt the four colorectal Notes as evidence-verified, no-cuts chapters with
  clearer study-level bullets, shorter prose and explicit cross-note ownership.
- Added lossless canonical-Doc round-tripping for numbered trial references,
  ordinary links and nested lists; removed all YX attribution from the released
  colorectal chapters.

## [1.5.0] - 2026-08-12

- Added deterministic suite-wide search across Notes, Evidence, Staging, Drugs,
  Tox and Acute while preserving every module's existing local search.
- Added an offline IndexedDB search snapshot with checksum-verified, atomic
  catalogue updates and a memory fallback when browser storage is unavailable.
- Global results open the exact trial, note section, staging entry, drug,
  toxicity topic or oncological emergency.

## [1.4.15] - 2026-08-11

- Rebuilt the colorectal molecular, early-colon and advanced/metastatic notes
  from the applied evidence layer, with independent clinical QA and exact
  Google Docs round-trips.
- Removed inherited YX attribution from the three replacement chapters;
  unsupported source-note claims are withheld rather than published.

## [1.4.14] - 2026-08-11

- Replaced the six module disclaimer footers with concise, module-specific
  clinical-reference wording and removed the stale Radiopaedia attribution
  from the Staging footer.
- Centred the complete disclaimer block responsively across desktop and mobile.

## [1.4.13] - 2026-08-10

- Notes and Evidence use `Gastrointestinal`, `Thoracic` and `Lymphoma` consistently.
- Staging now mirrors the applicable Evidence categories, with dedicated Skin and Sarcoma sections; out-of-scope myeloma staging was removed.

## [1.4.12] - 2026-08-10

- Notes: landing cards now use Evidence-system headings (GI, Thoracic, Haematological and Skin), Tox's tracked full-caps title treatment, and no note-count line.

## [1.4.11] - 2026-08-09

- Notes: Early rectal cancer rebuilt from the complete source note without cuts, restructured to the DLBCL reference standard, independently QA-sealed, and round-tripped through its existing canonical Google Doc.

## [1.4.10] - 2026-08-09

- Notes: Colorectal group added — molecular pathology and genetics, localized colon cancer, early rectal cancer, and metastatic colorectal cancer, each sealed under two-round clinical QA and an exact Google Docs/cache round-trip.

## [1.4.9] - 2026-08-09

- Notes: Lymphoma group added — diffuse large B-cell lymphoma, Hodgkin lymphoma, and indolent non-Hodgkin lymphomas, each sealed after two-round adversarial QA.

## [1.4.8] - 2026-08-09

- Notes: Breast group added — five chapters (histopathology/receptors/staging, DCIS, early, neoadjuvant, metastatic), QA-sealed against 171 evidence rows + wiki synthesis.

## [1.4.7] - 2026-08-09

- Notes: Lung group added — four chapters (NSCLC classification/staging/molecular, early & locally advanced, metastatic, SCLC), QA-sealed and enriched from 145 evidence rows + wiki synthesis.

## [1.4.6] - 2026-08-09

- Notes: Melanoma rephrased under the phraseology/concision rules (scientific register, no fourth wall, direct phrasing); claim-preserving, diff-verified.

## [1.4.5] - 2026-08-09

- Notes: full-width note layout on desktop (wrapping section bar, justified hyphenated paragraphs).

## [1.4.4] - 2026-08-09

- Notes: Melanoma reformatted to revision-guide density (proportional paragraphs, bullets) under the new presentation rules; claim-preserving, diff-verified.

## [1.4.3] - 2026-08-09

- Notes moved to the first position in the home launcher and module navigation.

## [1.4.2] - 2026-08-09

- Notes: per-note References section compiled from the Evidence rows (citation text + PDF links); source-attribution and dropped-figure flags removed from the rendered page.

## [1.4.1] - 2026-08-09

- Notes: provenance chips removed from the rendered page (tokens remain in the backend as the verification record).

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
