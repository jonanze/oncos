# Landmark Oncology Trials

A searchable, single-page reference of practice-changing solid-tumour and lymphoma trials, organised by tumour system and clinical setting. Filter by phase and year, search across studies, drugs and populations, and click through to the source publication.

**Live site:** https://jonanze.github.io/landmark-oncology-trials/

For clinicians and medical education. Entries summarise published clinical trials and are a navigational aid, not a primary source — verify against the cited publication before any clinical use. Not medical advice, and not a substitute for professional judgement or patient-specific care. Drug access, registration, and funding vary by country.

## How it's built

`index.html` is generated from a curated workbook (`OncOS_Evidence.xlsx`) by `build_dashboard.py`. The HTML is self-contained — all data is baked in, no server or network needed. Do not hand-edit `index.html`; change the workbook or the build script and regenerate.
