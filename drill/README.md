# Drill sources

Master copy of the Drill module (oncos.vercel.app/drill/), formerly staging-drill.vercel.app. Excluded from the deployment by `.vercelignore`; the site serves `views/drill.html`.

- `src/head.html` styles; `src/vignettes.js` finding bank; `src/core.js` hand systems (lung, colorectal, breast, oral cavity, oesophagus), generators and definitions; `src/debrief.js` debrief rules and treatment rows; `src/evidence-links.json` trial name to Evidence row id; `src/ui.js` interface.
- `src/sites.js` is generated: `python3 build_sites.py <staging_data.json> sites.js` expands the Staging module's stage groups. Never edit it by hand.
- Module build (kit, `2026-07-18-oncos-one`): `ONCOS_SITE_OUT=<site> python3 fragmentize.py drill` regenerates `sites.js` from the Staging data, checks every Evidence link id against `search/evidence.json`, and writes `views/drill.html`; then `python3 build_shell.py`.
- Inside the shell, Table opens the case's cancer in Staging (`/staging/?record=<id>`, plus `#<block>` for the oesophagus groupings, mapped in `build_sites.py` ANCHORS) and a linked trial opens its Evidence row (`/evidence/#<id>`); the open case is kept, so Back returns to it.
- Tests: `node test.js <staging_data.json>` (tables against the Staging data, 3000 cases per system), `node dbtest.js` (debrief rows), `node shot_module.js <site URL>` (Chromium and WebKit in the shell: 180 cases, Table, Evidence and Appendix round trips). `node shot7.js` fuzzes the standalone page from `./build.sh sites.js vignettes.js core.js debrief.js ui.js`.
