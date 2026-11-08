# Staging drill sources

Source of the staging recall drill (formerly staging-drill.vercel.app, artifact DY82TqvZRRweKenJzmcT82 v14).

- `src/head.html` head and styles; `src/sites.js` generated tables (from `build_sites.py` over the Staging module data); `src/vignettes.js` finding bank; `src/core.js` generators and definitions; `src/debrief.js` debrief rules and treatment rows; `src/ui.js` interface.
- Build (standalone page): `cd src && ./build.sh sites.js vignettes.js core.js debrief.js ui.js` writes `publish.html`.
- Tests: `node test.js` (tables vs Staging data), `node dbtest.js` (every case has a debrief row), `node shot7.js` (Playwright fuzz).
- `build_sites.py` should read the Staging module data at release time so the drill never drifts from the tables.
