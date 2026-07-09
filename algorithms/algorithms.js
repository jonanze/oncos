/* OncOS — Algorithms module data.
 *
 * Tumour-type-specific treatment pathways. Each entry is an index card (id, title,
 * system, tumour, summary, verified) PLUS a `graph` the renderer in index.html draws.
 *
 * GRAPH SCHEMA (data-driven node renderer):
 *   graph: {
 *     w: <canvas width>, h: <canvas height>,            // SVG viewBox extent
 *     nodes: [{
 *       id, kind, x, y, w, h,                            // kind: entry|decision|option|ghost|note
 *       title,                                            // bold heading (entry/option/decision)
 *       sub,                                              // one muted line under the title
 *       lines: ['muted detail line', ...],               // option/ghost/note body lines
 *       tox: 'red toxicity line',                         // option only, optional
 *       chips: [{t:'label', k:'ev'|'hsa'|'cdl'|'tox'}],  // option only
 *       tone: 'distinct'                                  // amber dashed (e.g. a separate limb)
 *     }],
 *     edges: [{ from, to, label, dashed, pts:[[x,y],...] }]  // pts overrides the auto elbow
 *   }
 *
 * Access chips marked "⚑ verify" are PROVISIONAL — confirm vs the HSA register + live
 * MOH CDL before relying on them. Evidence figures are workbook-verified (cite the paper).
 *
 * TEMPLATE — copy one block per algorithm. `system` must match a SYSTEMS value in index.html.
 */
window.ALGORITHMS = [
  {
    id: 'nsclc-egfr-sensitising-advanced',
    title: 'NSCLC — EGFR mutations, advanced/metastatic',
    system: 'Thoracic',
    tumour: 'NSCLC (EGFR+)',
    summary: 'EGFR-mutant advanced NSCLC across three lanes: classical sensitising (1L + progression), uncommon mutations, and exon 20 insertions.',
    verified: '2026-06-30',
    cdlDate: '1 Jun 2026',
    accessNote: 'subsidy verified against the MOH Cancer Drug List (1 Jun 2026); HSA registration against the data.gov.sg HSA register (snapshot Jul 2025). Osimertinib (Tagrisso) is HSA-registered but first-line use is UNSUBSIDISED (CDL “No subsidy”, MediShield Life claim limit $2,400/mo); it is MAF-subsidised only for T790M-positive disease after a prior EGFR TKI. Amivantamab (Rybrevant) is HSA-registered but not on the CDL (self-funded). *Lazertinib and savolitinib were NOT in the register snapshot — the amivantamab + lazertinib regimen may not be prescribable on-label in Singapore; confirm current status on the live HSA PRISM portal. Platinum, pemetrexed, etoposide are SDL; afatinib (Giotrif) and the older TKIs (gefitinib/erlotinib/dacomitinib) are registered and subsidised (MAF/SDL). For exon 20 insertions, amivantamab (PAPILLON; ≥2L monotherapy) is HSA-registered but not on the CDL; sunvozertinib (FDA Jul 2025) has unconfirmed SG availability and mobocertinib has been withdrawn.',
    status: 'complete across classical (1L + progression), uncommon, and exon 20 lanes; access verified (CDL 1 Jun 2026, HSA register Jul 2025)',
    graph: {
      w: 740, h: 1585,
      nodes: [
        { id: 'entry', kind: 'entry', x: 150, y: 16, w: 360, h: 56,
          title: 'Advanced EGFR-mutant NSCLC',
          sub: 'Classical sensitising (ex19del / L858R) · NGS · brain MRI · PS' },

        { id: 'exon20', kind: 'option', tone: 'distinct', x: 528, y: 18, w: 204, h: 50,
          title: 'EGFR exon 20 insertion',
          sub: 'distinct — see pathway below ↓' },

        { id: 'risk', kind: 'decision', x: 252, y: 98, w: 156, h: 60,
          title: 'Frail / low burden?' },

        { id: 'risknote', kind: 'note', x: 430, y: 92,
          lines: ['intensification preferred', '(judgement): FLAURA2 &', 'MARIPOSA both improve OS'] },

        { id: 'mono', kind: 'option', x: 20, y: 214, w: 300, h: 110,
          title: 'Osimertinib monotherapy',
          lines: ['FLAURA · PFS 18.9 vs 10.2 mo (HR 0.46)',
                  'OS 38.6 vs 31.8 mo · CNS-active · best tolerated'],
          chips: [{ t: 'Ph III', k: 'ev' }, { t: 'HSA ✓', k: 'hsa' }, { t: 'CDL: no subsidy (1L)', k: 'no' }] },

        { id: 'flaura2', kind: 'option', x: 360, y: 210, w: 360, h: 94,
          title: 'Osimertinib + platinum–pemetrexed',
          lines: ['FLAURA2 · PFS 25.5 vs 16.7 mo (HR 0.62)',
                  'OS 47.5 vs 37.6 mo (HR 0.77, P=0.02) — significant'],
          chips: [{ t: 'Ph III', k: 'ev' }, { t: 'Osimertinib: no subsidy', k: 'no' }, { t: 'Chemo: SDL', k: 'hsa' }] },

        { id: 'mariposa', kind: 'option', x: 360, y: 320, w: 360, h: 114,
          title: 'Amivantamab + lazertinib',
          lines: ['MARIPOSA · PFS 23.7 vs 16.6 mo (HR 0.70)',
                  'OS NR vs 36.7 mo (HR 0.75, P<0.005) — significant'],
          tox: 'Toxicity: rash/paronychia · VTE (prophylaxis) · IRR',
          chips: [{ t: 'Ph III', k: 'ev' }, { t: 'Amivantamab not on CDL', k: 'no' }, { t: 'Lazertinib not HSA-reg*', k: 'no' }] },

        { id: 'prog', kind: 'entry', x: 140, y: 468, w: 470, h: 50,
          title: 'On progression — re-biopsy',
          sub: 'Tissue ± plasma NGS → identify resistance mechanism (after any 1L option)' },

        { id: 'mech_oligo', kind: 'option', x: 180, y: 540, w: 480, h: 58,
          title: 'Oligoprogression / CNS-only',
          lines: ['→ Local ablative therapy (SRS/SBRT) + continue the TKI'],
          chips: [{ t: 'consensus', k: 'ev' }] },
        { id: 'mech_met', kind: 'option', x: 180, y: 614, w: 480, h: 62,
          title: 'MET amplification',
          lines: ['→ Osimertinib + savolitinib (SAVANNAH) or amivantamab-based'],
          chips: [{ t: 'investigational', k: 'ev' }, { t: 'Savolitinib: not HSA-registered', k: 'no' }] },
        { id: 'mech_sclc', kind: 'option', x: 180, y: 692, w: 480, h: 58,
          title: 'Histologic transformation (small-cell)',
          lines: ['→ Platinum–etoposide (treat as small-cell lung cancer)'],
          chips: [{ t: 'Platinum–etoposide: SDL', k: 'hsa' }] },
        { id: 'mech_ontarget', kind: 'option', x: 180, y: 766, w: 480, h: 58,
          title: 'On-target EGFR resistance (e.g. C797S)',
          lines: ['→ Context-specific; prioritise a clinical trial'] },
        { id: 'mech_indep', kind: 'option', x: 180, y: 840, w: 480, h: 84,
          title: 'EGFR-independent / no targetable driver',
          lines: ['→ Platinum–pemetrexed ± amivantamab',
                  'MARIPOSA-2: PFS 6.3 vs 4.2 mo (HR 0.48); + lazertinib 8.3 mo (HR 0.44)'],
          chips: [{ t: 'Ph III', k: 'ev' }, { t: 'Chemo: SDL', k: 'hsa' }, { t: 'Amivantamab: HSA-reg, not on CDL', k: 'no' }] },
        { id: 'emerging', kind: 'ghost', x: 180, y: 942, w: 480, h: 48,
          lines: ['Emerging post-osimertinib (not standard): HER3-DXd / patritumab',
                  'deruxtecan (HERTHENA-Lung) · datopotamab deruxtecan (TROPION-Lung)'] },

        // ---- Lane 2: uncommon sensitising EGFR (G719X / L861Q / S768I) ----
        { id: 'unc_hdr', kind: 'entry', x: 140, y: 1046, w: 470, h: 50,
          title: 'Uncommon sensitising EGFR mutation',
          sub: 'G719X · L861Q · S768I — NOT exon 20 insertion' },
        { id: 'afatinib', kind: 'option', x: 40, y: 1122, w: 330, h: 96,
          title: 'Afatinib (preferred)',
          lines: ['ACHILLES: afatinib > platinum chemo (RCT)',
                  'FDA-approved for G719X / L861Q / S768I'],
          chips: [{ t: 'Ph III', k: 'ev' }, { t: 'HSA ✓', k: 'hsa' }, { t: 'CDL: MAF', k: 'hsa' }] },
        { id: 'osi_unc', kind: 'option', x: 390, y: 1122, w: 330, h: 96,
          title: 'Osimertinib (alternative)',
          lines: ['KCSG-LU15-09 ph II: ORR 50%, mPFS 8.2 mo',
                  'Best activity in L861Q; guideline-listed'],
          chips: [{ t: 'Ph II', k: 'ev' }, { t: 'HSA ✓', k: 'hsa' }, { t: 'CDL: no subsidy', k: 'no' }] },

        // ---- Lane 3: EGFR exon 20 insertion (de novo TKI-resistant) ----
        { id: 'ex20_hdr', kind: 'entry', x: 140, y: 1252, w: 470, h: 50,
          title: 'EGFR exon 20 insertion',
          sub: 'de novo TKI-resistant — distinct biology' },
        { id: 'ex20_1l', kind: 'option', x: 40, y: 1328, w: 680, h: 80,
          title: '1L: Amivantamab + carboplatin–pemetrexed (PAPILLON)',
          lines: ['PFS 11.4 vs 6.7 mo (HR 0.40)'],
          chips: [{ t: 'Ph III', k: 'ev' }, { t: 'Amivantamab: HSA-reg, not on CDL', k: 'no' }, { t: 'Chemo: SDL', k: 'hsa' }] },
        { id: 'ex20_2l', kind: 'option', x: 40, y: 1430, w: 680, h: 90,
          title: '≥2L (post-platinum)',
          lines: ['Amivantamab monotherapy (CHRYSALIS) — HSA-registered',
                  'Sunvozertinib (Zegfrovy) — FDA-approved 2025; SG availability unconfirmed*'],
          chips: [{ t: 'emerging options', k: 'ev' }] },
        { id: 'ex20_note', kind: 'note', x: 44, y: 1544,
          lines: ['* Mobocertinib withdrawn (2023, EXCLAIM-2 negative) — not recommended.',
                  'Zipalertinib investigational (FDA review).'] }
      ],
      edges: [
        { from: 'entry', to: 'risk' },
        { from: 'risk', to: 'mono', label: 'Yes — frail / low burden', lpos: [162, 182], lanchor: 'end',
          pts: [[252, 128], [170, 128], [170, 214]] },
        { from: 'risk', to: 'flaura2', label: 'No — intensify (preferred)', lpos: [366, 202],
          pts: [[408, 128], [345, 128], [345, 257], [360, 257]] },
        { from: 'risk', to: 'mariposa',
          pts: [[345, 257], [345, 367], [360, 367]] },
        { from: 'mono', to: 'prog', dashed: true,
          pts: [[170, 324], [170, 452], [375, 452], [375, 468]] },
        { from: 'mariposa', to: 'prog', dashed: true, noarrow: true,
          pts: [[540, 434], [540, 452], [375, 452]] },
        { from: 'prog', to: 'mech_oligo', pts: [[375, 518], [150, 518], [150, 569], [180, 569]] },
        { from: 'prog', to: 'mech_met', pts: [[150, 569], [150, 645], [180, 645]] },
        { from: 'prog', to: 'mech_sclc', pts: [[150, 645], [150, 721], [180, 721]] },
        { from: 'prog', to: 'mech_ontarget', pts: [[150, 721], [150, 795], [180, 795]] },
        { from: 'prog', to: 'mech_indep', pts: [[150, 795], [150, 882], [180, 882]] },
        { from: 'mech_indep', to: 'emerging', dashed: true, noarrow: true,
          pts: [[420, 924], [420, 942]] },
        { from: 'unc_hdr', to: 'afatinib', pts: [[375, 1096], [375, 1110], [205, 1110], [205, 1122]] },
        { from: 'unc_hdr', to: 'osi_unc', pts: [[375, 1096], [375, 1110], [555, 1110], [555, 1122]] },
        { from: 'ex20_hdr', to: 'ex20_1l', pts: [[375, 1302], [375, 1315], [380, 1315], [380, 1328]] },
        { from: 'ex20_1l', to: 'ex20_2l', label: 'on progression', lpos: [392, 1424],
          pts: [[380, 1408], [380, 1430]] }
      ]
    }
  }
];
