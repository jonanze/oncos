/* oncOS — Algorithms module data.
 *
 * Tumour-type-specific treatment pathways. Each entry is an index card (id, title,
 * system, tumour, summary, verified) PLUS a set of collapsible `sections`, each a
 * vertical flow of nodes the renderer in index.html lays out responsively.
 *
 * SECTIONED-FLOW SCHEMA (no coordinates — the renderer stacks nodes top-to-bottom):
 *   sections: [{
 *     id, title,                         // section header (the collapsible bar)
 *     open: true|false,                  // default expanded state
 *     nodes: [{
 *       kind: 'entry'|'decision'|'option'|'subhead'|'note',
 *       eyebrow,                          // option only: small uppercase branch label
 *       title,                            // heading (entry/decision/option/subhead); note may use title
 *       sub,                              // one muted line under title (entry/decision)
 *       lines: ['detail line', ...],      // option/note body lines
 *       tox: 'red toxicity line',         // option only, optional
 *       chips: [{ t:'label', k:'ph3'|'ph2'|'abs'|'con'|'low' }],  // evidence tier only
 *       tone: 'distinct'|'terminal'       // distinct = amber-dashed (lower-tier / awaiting RCT)
 *     }]
 *   }]
 *
 * Evidence-only: no access/funding content. Chips carry evidence TIER, not availability.
 * Every effect size is reconciled against the primary publication (via the oncOS evidence
 * base / wiki). Cite the underlying trial, never this diagram. Never invent a number.
 *
 * TEMPLATE — copy one block per algorithm. `system` must match a SYSTEMS value in index.html.
 */
window.ALGORITHMS = [
  {
    id: 'nsclc-egfr-sensitising-advanced',
    title: 'NSCLC — EGFR mutations, advanced/metastatic',
    system: 'Thoracic',
    tumour: 'NSCLC (EGFR+)',
    desktopFlow: true,   // per-section flowcharts on desktop (no arms — sections are separate scenarios)
    summary: 'First-line (classical), post-osimertinib (2L), uncommon-mutation, and exon-20 pathways for EGFR-mutant advanced NSCLC — reconciled with the oncOS wiki. Evidence-only.',
    verified: '2026-07-09',
    provenance: 'Effect sizes are drawn from the oncOS evidence base and reconciled with the primary publications; cite the underlying trial, not this diagram. A reference aid, not a prescribing system.',
    sections: [

      // ============ 1. FIRST-LINE (classical sensitising) ============
      {
        id: 'first-line',
        title: 'First-line — classical sensitising (ex19del / L858R)',
        open: true,
        nodes: [
          { kind: 'entry', title: 'Advanced EGFR-mutant NSCLC — classical sensitising',
            sub: 'ex19del / L858R · NGS · brain MRI · performance status' },
          { kind: 'decision', title: 'Higher-risk features?',
            sub: 'brain metastases · L858R · high disease burden → favour intensification' },

          { kind: 'option', eyebrow: 'If standard-risk / frailer',
            title: 'Osimertinib monotherapy',
            lines: ['FLAURA: PFS 18.9 vs 10.2 mo (HR 0.46)',
                    'OS 38.6 vs 31.8 mo · CNS-active · best tolerated'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },

          { kind: 'subhead', title: 'If higher-risk — intensify beyond monotherapy' },

          { kind: 'option', branch: true, title: 'Osimertinib + platinum–pemetrexed',
            lines: ['FLAURA2: PFS 25.5 vs 16.7 mo (HR 0.62)',
                    'OS 47.5 vs 37.6 mo (HR 0.77) · grade ≥3 AE 70% vs 34%'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, title: 'Amivantamab + lazertinib',
            lines: ['MARIPOSA: PFS 23.7 vs 16.6 mo (HR 0.70)',
                    'OS NR vs 36.7 mo (HR 0.75) — chemo-free intensification'],
            tox: 'Toxicity: rash / paronychia · VTE (prophylaxis) · infusion reactions',
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'note', title: 'FLAURA2 vs MARIPOSA — no significant difference on indirect comparison (PFS HR 0.79, OS HR 0.95). Choose on toxicity axis (cytopenias vs skin / VTE / infusion), administration burden, and patient factors.' },

          { kind: 'option', tone: 'distinct', eyebrow: 'Lower-toxicity route — not yet randomised',
            title: 'Osimertinib + consolidative SBRT',
            lines: ['SAMPATH: mPFS 32.3 mo, mOS 45 mo (single-arm, N=42)',
                    'mostly grade 1–2 toxicity; awaiting NORTHSTAR RCT'],
            chips: [{ t: 'Ph II · single-arm', k: 'ph2' }] },
          { kind: 'note', title: 'Chemo-intensification is a class effect, not osimertinib-specific — reproduced with aumolertinib (AENEAS2: PFS 28.9 vs 18.9 mo, HR 0.47).' }
        ]
      },

      // ============ 2. POST-OSIMERTINIB (2L) — decision-first ============
      {
        id: 'progression',
        title: 'On progression — post-osimertinib (2L)',
        open: true,
        nodes: [
          { kind: 'entry', title: 'Progression on 1L osimertinib — re-biopsy',
            sub: 'tissue ± plasma NGS · re-image CNS' },
          { kind: 'note', title: 'Resistance is polyclonal — FLAURA ctDNA: MET 16%, C797S 6%, no T790M, 65% no detectable mechanism, 39% >1 mechanism. No single dominant escape route.' },
          { kind: 'decision', title: 'Targetable mechanism or focal pattern on biopsy?',
            sub: 'read the biopsy and imaging first — matched options below, route menu if none' },

          { kind: 'option', branch: true, eyebrow: 'If oligoprogression / CNS-only',
            title: 'Local ablative therapy + continue osimertinib',
            lines: ['SRS / SBRT to progressing sites; CNS and oligo clones often stay TKI-sensitive'],
            chips: [{ t: 'consensus', k: 'con' }] },
          { kind: 'option', branch: true, eyebrow: 'If MET amplification — commonest bypass',
            title: 'Continue osimertinib + MET-TKI',
            lines: ['Savolitinib — SACHI: PFS 8.2 vs 4.5 mo (HR 0.34), first randomised proof',
                    'Tepotinib — INSIGHT-2: ORR 50% vs 8% MET-TKI alone · all-oral, mechanism-matched'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'If small-cell / squamous transformation',
            title: 'Platinum–etoposide',
            lines: ['treat as small-cell lung cancer; EGFR-directed therapy no longer relevant'],
            chips: [{ t: 'consensus', k: 'con' }] },
          { kind: 'option', branch: true, eyebrow: 'If on-target EGFR (C797S / acquired PACC), no T790M',
            title: 'Consider 2nd-generation TKI by allelic context / trial',
            lines: ['salvage depends on cis vs trans configuration with the founder mutation'],
            chips: [{ t: 'low-tier', k: 'low' }] },

          { kind: 'subhead', title: 'No matched target · broad progression — route menu' },

          { kind: 'option', branch: true, eyebrow: 'Switch',
            title: 'Amivantamab + platinum–pemetrexed (± lazertinib)',
            lines: ['MARIPOSA-2: PFS HR 0.48 (0.44 with lazertinib) · OS immature · heavy toxicity',
                    'replaces osimertinib; blankets the polyclonal landscape'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'Continue',
            title: 'Osimertinib + platinum–pemetrexed',
            lines: ['after non-CNS progression. COMPEL: PFS 8.4 vs 4.4 mo (HR 0.43); strong CNS protection',
                    'keeps the TKI for still-sensitive clones (underpowered, N=98)'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'Immunotherapy — bispecific',
            title: 'Ivonescimab (PD-1×VEGF) + chemotherapy',
            lines: ['HARMONi-A: PFS HR 0.46; OS 16.8 vs 14.1 mo (HR 0.74) — survival-positive',
                    'overturns "IO fails in EGFR" — needs the VEGF arm. China-only'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'ADC — by surface antigen (mechanism-independent)',
            title: 'TROP2 / HER3 antibody–drug conjugate',
            lines: ['Sac-TMT — OptiTROP-Lung04: PFS HR 0.49, OS HR 0.60 — first OS-positive 2L agent; no ILD',
                    'HER3-DXd — HERTHENA-Lung02: PFS HR 0.77 · Dato-DXd — TROPION-Lung01: OS-neg, ILD signal'],
            chips: [{ t: 'Ph III', k: 'ph3' }, { t: 'HER3-DXd: abstract', k: 'abs' }] }
        ]
      },

      // ============ 3. POST-OSIMERTINIB — additional routes & context ============
      {
        id: 'progression-extra',
        title: 'Post-osimertinib — additional routes & context',
        open: false,
        nodes: [
          { kind: 'note', title: 'Context behind the route menu above — precursor, single-arm, and superseded evidence, kept for completeness. Not first-reach options.' },

          { kind: 'option', branch: true, eyebrow: 'MET-matched — single-arm anchor',
            title: 'INSIGHT-2 — tepotinib + osimertinib',
            lines: ['MET-amplified post-osimertinib: ORR 50% (vs 8% tepotinib alone); PFS 5.6 mo; all-oral'],
            chips: [{ t: 'Ph II · single-arm', k: 'ph2' }] },
          { kind: 'option', branch: true, eyebrow: 'IO + anti-angiogenic — precursor signal',
            title: 'IMpower150 — ABCP, EGFR subgroup',
            lines: ['exploratory subgroup: PFS 9.7 vs 6.1 mo (HR 0.59) — the VEGF + IO signal'],
            chips: [{ t: 'reference · subgroup', k: 'low' }] },
          { kind: 'option', branch: true, eyebrow: 'IO + anti-angiogenic — PFS-only Ph III',
            title: 'ATTLAS — ABCP vs pemetrexed–platinum',
            lines: ['PFS HR 0.62 (HR 0.24 at PD-L1 ≥50%); OS flat (HR 1.01) — four-drug route, survival-negative'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'TROP2 ADC — single-arm anchor',
            title: 'TROPION-Lung05 — datopotamab deruxtecan',
            lines: ['EGFR ORR 43.6% (49.1% osimertinib-pretreated); uncontrolled'],
            chips: [{ t: 'Ph II · single-arm', k: 'ph2' }] },
          { kind: 'option', branch: true, eyebrow: 'TROP2 ADC — randomised, OS-negative',
            title: 'TROPION-Lung01 — Dato-DXd vs docetaxel',
            lines: ['PFS HR 0.75 (met); OS HR 0.94 (not met); nonsquamous-only benefit; fatal ILD 8.8%'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'note', title: 'Survival bar: until OptiTROP-Lung04, every 2L route improved PFS but left OS immature or flat. Sac-TMT (OS HR 0.60) and HARMONi-A final (OS HR 0.74) are the first to clear it.' }
        ]
      },

      // ============ 4. UNCOMMON SENSITISING MUTATIONS ============
      {
        id: 'uncommon',
        title: 'Uncommon sensitising mutations (G719X · L861Q · S768I)',
        open: false,
        nodes: [
          { kind: 'entry', title: 'Uncommon sensitising EGFR mutation',
            sub: 'G719X · L861Q · S768I · compound — NOT exon 20 insertion' },
          { kind: 'note', title: 'Structural class guides the TKI: PACC (G719X, S768I) → afatinib binds better; classical-like (L861Q) → osimertinib (Robichaux, Nature 2021). Choose mutation by mutation.' },

          { kind: 'option', branch: true, eyebrow: 'Broad pan-HER — preferred for PACC / compound',
            title: 'Afatinib',
            lines: ['ACHILLES (RCT): PFS 10.6 vs 5.7 mo (HR 0.42) vs platinum–pemetrexed; best in compound mutations'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'Mutant-selective — preferred for classical-like L861Q',
            title: 'Osimertinib',
            lines: ['UNICORN: ORR 55%, PFS 9.4 mo (best on L861Q) · KCSG-LU15-09: ORR 50%, exceptionally clean'],
            chips: [{ t: 'Ph II · single-arm', k: 'ph2' }] },
          { kind: 'option', branch: true, eyebrow: 'Escalation if the single-agent match is poor',
            title: 'Amivantamab + lazertinib',
            lines: ['CHRYSALIS-2 (Cohort C): ORR 52% (treatment-naïve PFS 19.5 mo); PACC ORR 45%',
                    'structure-agnostic but the heaviest, IV-combination toxicity (VTE ~30%)'],
            chips: [{ t: 'Ph I/II', k: 'ph2' }] }
        ]
      },

      // ============ 5. EXON 20 INSERTIONS ============
      {
        id: 'exon20',
        title: 'Exon 20 insertions',
        open: false,
        nodes: [
          { kind: 'entry', title: 'EGFR exon 20 insertion',
            sub: 'de novo TKI-resistant — distinct biology · NGS (PCR misses ~50%)' },
          { kind: 'subhead', title: 'First-line — two options beat chemotherapy (not cleanly rankable)' },

          { kind: 'option', branch: true, eyebrow: 'Antibody + chemo (IV)',
            title: 'Amivantamab + carboplatin–pemetrexed',
            lines: ['PAPILLON: PFS 11.4 vs 6.7 mo (HR 0.40); ORR 73% — deeper response, IV / chemo burden'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'Oral, chemo-free',
            title: 'Sunvozertinib',
            lines: ['WU-KONG28: PFS 10.3 vs 7.5 mo (HR 0.65); ORR 59% — oral convenience, TKI toxicity',
                    'succeeds where mobocertinib (EXCLAIM-2) failed'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'note', title: 'Different control arms mean the hazard ratios overstate the gap; absolute medians are close. Neither has proven OS. Choose on response depth + IV/chemo burden vs oral convenience.' },

          { kind: 'option', eyebrow: '≥2L (post-platinum)',
            title: 'Amivantamab monotherapy · or sunvozertinib if not used first-line',
            lines: ['amivantamab (CHRYSALIS) established the ≥2L benchmark'],
            chips: [{ t: 'Ph I/II', k: 'ph2' }] },
          { kind: 'note', title: 'Mobocertinib withdrawn (2023, EXCLAIM-2 negative). Zipalertinib investigational.' }
        ]
      }

    ]
  },

  {
    id: 'breast-tnbc-early',
    title: 'Breast — early triple-negative (TNBC)',
    system: 'Breast',
    tumour: 'TNBC (early)',
    desktopFlow: true,   // ≥980px: render as a connected flowchart (arms side-by-side, SVG connectors); mobile unchanged
    summary: 'Stage-directed (neo)adjuvant pathway for early triple-negative breast cancer — small node-negative disease vs the KEYNOTE-522 neoadjuvant chemo-immunotherapy route, with post-neoadjuvant escalation by pathological response and germline BRCA status. Evidence-only.',
    verified: '2026-07-09',
    provenance: 'Effect sizes are drawn from the oncOS evidence base and reconciled with the primary publications; cite the underlying trial, not this diagram. A reference aid, not a prescribing system.',
    sections: [

      // ============ 1. DIAGNOSIS & WORK-UP ============
      {
        id: 'workup',
        title: 'Diagnosis & work-up',
        open: true,
        nodes: [
          { kind: 'entry', title: 'Early triple-negative breast cancer',
            sub: 'ER & PR <1% · HER2-negative (IHC 0–1+ or ISH−) · confirm on core biopsy' },
          { kind: 'note', title: 'Germline BRCA1/2 testing and clinical-genetics referral at diagnosis — the result drives adjuvant olaparib eligibility (OlympiA) in both arms below. Offer fertility-preservation counselling before chemotherapy begins.' },
          { kind: 'note', title: 'PD-L1 is not required in early TNBC — the neoadjuvant chemo-immunotherapy benefit (KEYNOTE-522) is independent of PD-L1 status, unlike the metastatic setting. Do not let PD-L1 gate the decision.' },
          { kind: 'decision', title: 'Stage — cT2 or node-positive?',
            sub: 'the threshold that routes ≤cT1c N0 to upfront surgery vs cT2 / node-positive to neoadjuvant chemo-immunotherapy' }
        ]
      },

      // ============ 2. ≤cT1c N0 — UPFRONT SURGERY ============
      {
        id: 'small-node-neg',
        title: 'If ≤cT1c N0 — upfront surgery',
        role: 'branch', branchLabel: '≤cT1c N0',
        open: true,
        nodes: [
          { kind: 'option', eyebrow: 'Local therapy first',
            title: 'Upfront surgery ± whole-breast radiotherapy',
            lines: ['definitive surgery first; adjuvant systemic therapy decided on final pathology'],
            chips: [{ t: 'consensus', k: 'con' }] },

          { kind: 'subhead', title: 'Adjuvant systemic therapy — by final pathology' },

          { kind: 'option', branch: true, eyebrow: 'pT1a pN0',
            title: 'No adjuvant systemic therapy',
            lines: ['very-low-risk; chemotherapy benefit does not outweigh the harm'],
            chips: [{ t: 'consensus', k: 'con' }] },
          { kind: 'option', branch: true, eyebrow: 'pT1b pN0, or >pT1b / node-positive',
            title: 'Adjuvant chemotherapy — 6–8 cycles',
            lines: ['anthracycline–taxane (e.g. dose-dense AC→T); TNBC has no genomic de-escalation assay'],
            chips: [{ t: 'consensus', k: 'con' }] },
          { kind: 'option', branch: true, eyebrow: 'gBRCA1/2m + high-risk',
            title: 'Add adjuvant olaparib — 1 year',
            lines: ['OlympiA: 3-yr iDFS 85.9 vs 77.1% (HR 0.58); OS HR 0.68',
                    'high-risk after surgery = ≥pT2 or node-positive (OlympiA entry)'],
            chips: [{ t: 'Ph III', k: 'ph3' }] }
        ]
      },

      // ============ 3. cT2 / NODE-POSITIVE — NEOADJUVANT ============
      {
        id: 'neoadjuvant',
        title: 'If cT2 or node-positive — neoadjuvant',
        role: 'branch', branchLabel: 'cT2 / node-positive',
        open: true,
        nodes: [
          { kind: 'option', eyebrow: 'Neoadjuvant chemo-immunotherapy — standard',
            title: 'Pembrolizumab + chemotherapy (KEYNOTE-522)',
            lines: ['pembrolizumab + carboplatin/paclitaxel → pembrolizumab + AC',
                    'pCR 64.8 vs 51.2%; EFS HR 0.63; 5-yr OS 86.6 vs 81.7% (HR 0.66)'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },

          { kind: 'decision', title: 'Surgery — response and germline status',
            sub: 'pCR (ypT0/Tis ypN0) vs residual invasive disease (grade with RCB); pembrolizumab continues to 1 year either way' },

          { kind: 'option', branch: true, eyebrow: 'If pCR',
            title: 'Complete adjuvant pembrolizumab to 1 year',
            lines: ['no added cytotoxic — adjuvant pembrolizumab ×9 (KEYNOTE-522)'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', tone: 'distinct', branch: true, eyebrow: 'If residual + gBRCA1/2m',
            title: 'Pembrolizumab + olaparib',
            lines: ['olaparib 1 yr — OlympiA: 3-yr iDFS 85.9 vs 77.1% (HR 0.58), OS HR 0.68'],
            chips: [{ t: 'Ph III · combination off-trial', k: 'ph3' }] },
          { kind: 'option', tone: 'distinct', branch: true, eyebrow: 'If residual + gBRCA wild-type',
            title: 'Pembrolizumab + capecitabine',
            lines: ['capecitabine — CREATE-X (HER2−): 5-yr DFS 74.1 vs 67.6% (HR 0.70), OS HR 0.59; largest benefit in TNBC'],
            chips: [{ t: 'Ph III · combination off-trial', k: 'ph3' }] },
          { kind: 'note', title: 'Pembrolizumab continues to one year regardless of response. The pembrolizumab + olaparib and pembrolizumab + capecitabine doublets are pragmatic extrapolation — OlympiA and CREATE-X both predate routine neoadjuvant immunotherapy, so neither combination has randomised support.' },

          { kind: 'subhead', title: 'If no neoadjuvant pembrolizumab (ineligible / declined / pre-IO) and residual disease' },

          { kind: 'option', branch: true, eyebrow: 'gBRCA wild-type',
            title: 'Adjuvant capecitabine',
            lines: ['CREATE-X (HER2−): 5-yr DFS 74.1 vs 67.6% (HR 0.70), OS HR 0.59'],
            chips: [{ t: 'Ph III', k: 'ph3' }] },
          { kind: 'option', branch: true, eyebrow: 'gBRCA1/2m',
            title: 'Adjuvant olaparib — 1 year',
            lines: ['OlympiA: 3-yr iDFS 85.9 vs 77.1% (HR 0.58), OS HR 0.68'],
            chips: [{ t: 'Ph III', k: 'ph3' }] }
        ]
      },

      // ============ 4. RESIDUAL DISEASE — ON THE HORIZON ============
      {
        id: 'horizon',
        title: 'Residual disease — on the horizon',
        open: false,
        nodes: [
          { kind: 'note', title: 'Post-neoadjuvant options were established before immunotherapy. Phase III trials are testing antibody–drug conjugates on a pembrolizumab backbone in residual invasive disease — none has reported; read-outs are expected ~2027; none changes practice today.' },

          { kind: 'option', tone: 'distinct', branch: true, eyebrow: 'TROP2 ADC + IO',
            title: 'Sacituzumab govitecan + pembrolizumab — ASCENT-05',
            lines: ['vs pembrolizumab ± capecitabine, residual TNBC · NCT05633654'],
            chips: [{ t: 'Ph III · not reported', k: 'low' }] },
          { kind: 'option', tone: 'distinct', branch: true, eyebrow: 'TROP2 ADC ± IO',
            title: 'Datopotamab deruxtecan ± durvalumab — TROPION-Breast03',
            lines: ['vs investigator choice, stage I–III TNBC with residual disease · NCT05629585'],
            chips: [{ t: 'Ph III · not reported', k: 'low' }] },
          { kind: 'option', tone: 'distinct', branch: true, eyebrow: 'TROP2 ADC + IO',
            title: 'Sacituzumab tirumotecan + pembrolizumab — MK-2870 (OptiTROP)',
            lines: ['vs physician choice, non-pCR TNBC · NCT06393374'],
            chips: [{ t: 'Ph III · not reported', k: 'low' }] }
        ]
      }

    ]
  }
];
