# Changelog

All notable oncOS frontend releases are recorded here. Versions follow semantic versioning.

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
