// Debrief: per-site staging logic and stage-matched treatment (from the cheatsheet).
// Each site: logic, T/N/M/S rules, tx rows [match, treatment, trials]; match = stage list or fn(x).
// x = { s: stage, t, n, m, q, label, sclc, rectal }
(function () {
'use strict';
const t4 = x => /T4/.test(x.t);
const M1 = x => /^M1/.test(x.m);

const HN_N = 'N1 one ipsilateral node ≤3 cm, no ENE · N2a one ipsilateral node 3–6 cm · N2b several ipsilateral nodes · N2c bilateral or contralateral nodes · N3a node >6 cm · N3b clinical ENE';
const HN_S = 'I T1 N0 · II T2 N0 · III T3 N0 or T1–3 N1 · IVA T4a or N2 · IVB T4b or N3 · IVC M1';
const HN_TX = [
  [['0'], 'Excision and surveillance', ''],
  [['I', 'II'], 'Single modality, surgery or RT. Adjuvant RT after surgery for pT3–4, pN2–3, PNI, LVI or a close margin', ''],
  [['III', 'IVA', 'IVB'], 'Surgery with adjuvant RT; cisplatin-RT if margin positive or ENE. Non-surgical: cisplatin-RT. Resectable with CPS ≥1: perioperative pembrolizumab ※', 'EORTC 22931 / RTOG 9501 pooled, KEYNOTE-689 ※'],
  [['IVC'], 'Pembrolizumab alone or with platinum-FU, by CPS', 'KEYNOTE-048'],
];
const BIL_TX = [
  [['0'], 'Resection alone', ''],
  [x => !M1(x), 'Resection, then capecitabine for 6 months. ChemoRT for extrahepatic or gallbladder disease with R1 margin or node-positive', 'BILCAP, SWOG S0809'],
  [M1, 'Gemcitabine-cisplatin with durvalumab or pembrolizumab', 'TOPAZ-1, KEYNOTE-966'],
];
const NET_TX = [
  [x => !M1(x), 'Resection. No adjuvant therapy has shown benefit. Ki-67 grade is not part of TNM but decides management', ''],
  [M1, 'Somatostatin analogue; everolimus; PRRT if SSTR-positive (midgut); panNET also sunitinib or CAPTEM', 'CLARINET, PROMID, RADIANT-4, NETTER-1'],
];
const NET = {
  logic: 'T is size and depth. Ki-67 grade is not in TNM but decides treatment',
  T: 'Size thresholds about 1, 2 and 4 cm, with wall depth. Serosa or adjacent organ is T4',
  N: 'N1 any regional node. Jejunoileal: N2 is ≥12 nodes or a mesenteric mass >2 cm',
  M: 'panNET and jejunoileal: M1a liver only · M1b extrahepatic only · M1c both',
  S: 'I small, superficial · II larger or deeper · III T4 or N1 · IV M1',
  tx: NET_TX,
};

const SITES = {
  lung: {
    logic: 'T by size in 1 cm steps to 5 cm, then 7 cm. N by station number and side. M1a within the chest, M1b one lesion outside, M1c several',
    T: 'T1a ≤1 · T1b ≤2 · T1c ≤3 · T2a ≤4 · T2b ≤5 · T3 ≤7 · T4 >7 cm. T2 also visceral pleura or main bronchus. T3 also chest wall, phrenic nerve, parietal pericardium, nodule in the same lobe. T4 also mediastinum, carina, great vessels, vertebra, nodule in another ipsilateral lobe',
    N: 'Stations 10–14 on the same side are N1. Single-digit stations on the same side, including station 7, are N2 (N2a one station, N2b several). Contralateral, scalene or supraclavicular nodes are N3',
    M: 'M1a pleural or pericardial disease, contralateral lung nodule · M1b one extrathoracic lesion · M1c1 several lesions in one organ system · M1c2 several organ systems',
    S: 'N0 by size: IA ≤3 cm, IB ≤4, IIA ≤5, IIB ≤7, IIIA T4. N1: IIA for T1, IIB for T2. N2a: IIB for T1, IIIA for T2. N2b: IIIA or IIIB. N3: IIIB or IIIC. M1a–b IVA, M1c IVB',
    tx: [
      [x => x.sclc && M1(x), 'Extensive-stage SCLC: platinum-etoposide with atezolizumab or durvalumab', 'IMpower133, CASPIAN'],
      [x => x.sclc && /^T(1|2)/.test(x.t) && x.n === 'N0', 'SCLC T1–2 N0: lobectomy, then adjuvant platinum-etoposide', ''],
      [x => x.sclc, 'Limited-stage SCLC: concurrent chemoRT, then durvalumab', 'ADRIATIC'],
      [['0', 'IA1', 'IA2', 'IA3'], 'Resection alone. Sublobar resection acceptable for peripheral tumours ≤2 cm', 'JCOG0802, CALGB 140503'],
      [['IB'], 'Resection. Adjuvant chemotherapy is not routine below 4 cm. EGFR exon 19 or L858R: osimertinib for 3 years', 'ADAURA (7th-edition IB, 3–5 cm)'],
      [['IIA', 'IIB', 'IIIA'], 'Resectable without EGFR or ALK: neoadjuvant or perioperative chemo-immunotherapy. After upfront resection: cisplatin doublet, then osimertinib (EGFR), alectinib (ALK), or atezolizumab or pembrolizumab', 'CheckMate 816, KEYNOTE-671, AEGEAN, ADAURA, ALINA, IMpower010, KEYNOTE-091'],
      [['IIIB', 'IIIC'], 'Usually unresectable: chemoRT, then durvalumab for 1 year; EGFR-mutant: osimertinib after chemoRT. Selected resectable T3–4 N2 (IIIB): perioperative chemo-immunotherapy', 'PACIFIC, LAURA'],
      [['IVA', 'IVB'], 'Systemic therapy by driver and PD-L1. Oligometastatic: consider local consolidation', ''],
    ],
  },
  mesothelioma: {
    logic: 'T describes resectability: T3 is locally advanced but resectable, T4 is not',
    T: 'T1 ipsilateral pleura · T2 lung parenchyma or diaphragm muscle · T3 endothoracic fascia, mediastinal fat, one chest-wall focus, non-transmural pericardium · T4 diffuse chest wall, through the diaphragm, contralateral pleura, spine, myocardium',
    N: 'N1 ipsilateral intrathoracic nodes · N2 contralateral mediastinal or supraclavicular nodes',
    M: 'M1 distant',
    S: 'I T1 N0 · II T1 N1 or T2 N0 · IIIA T3, or T1–2 with more nodal disease · IIIB T4 · IV M1',
    tx: [
      [x => !M1(x), 'Systemic therapy. Extended pleurectomy-decortication worsened survival in MARS 2', 'MARS 2, CheckMate 743'],
      [M1, 'Nivolumab-ipilimumab (greatest gain in non-epithelioid) or chemotherapy with pembrolizumab', 'CheckMate 743, KEYNOTE-483'],
    ],
  },
  thymoma: {
    logic: 'Masaoka–Koga stages by extent: capsule, fat, adjacent organ, pleura or pericardium, distant',
    S: 'I encapsulated · IIa microscopic capsular invasion · IIb macroscopic invasion of fat or pleura · III adjacent organ · IVa pleural or pericardial seeding · IVb nodal or haematogenous',
    tx: [
      [['I'], 'Complete resection alone', ''],
      [['IIa', 'IIb'], 'Resection. PORT not routine; consider for IIb with B3 histology or a close margin', ''],
      [['III', 'IVa'], 'Induction chemotherapy if not resectable upfront, then resection and PORT', ''],
      [['IVb'], 'Cisplatin, doxorubicin and cyclophosphamide (CAP)', ''],
    ],
  },
  esophageal: {
    logic: 'T counts wall layers. N counts nodes: 1–2, 3–6, 7 or more. Five tables: clinical, pathological and post-treatment, split by histology',
    T: 'Tis high-grade dysplasia · T1a lamina propria or muscularis mucosae · T1b submucosa · T2 muscularis propria · T3 adventitia · T4a pleura, pericardium, azygos vein, diaphragm, peritoneum · T4b aorta, vertebra, airway',
    N: 'N1 1–2 nodes · N2 3–6 · N3 7 or more',
    M: 'M1 distant',
    S: 'Clinical: T4 or N3 is IVA. Pathological: grade, and location for SCC, split stages I–II. Post-treatment: node-positive is III; T4a node-positive or T4b is IVA',
    tx: [
      [M1, 'Chemotherapy with a PD-1 inhibitor, by PD-L1. HER2-positive adenocarcinoma: add trastuzumab', ''],
      [x => /ypTNM/.test(x.label) && x.t === 'T0' && x.n === 'N0', 'Pathological complete response: surveillance', ''],
      [x => /ypTNM/.test(x.label), 'Residual disease after neoadjuvant chemoRT and R0 resection: adjuvant nivolumab for 1 year', 'CheckMate 577'],
      [x => x.t === 'Tis' || (x.t === 'T1a' && x.n === 'N0'), 'Endoscopic resection', ''],
      [x => x.t === 'T1b' && x.n === 'N0', 'Oesophagectomy', ''],
      [x => /pTNM/.test(x.label), 'After upfront surgery. pT2 N0: surgery alone is accepted. pT3 or node-positive: neoadjuvant therapy was indicated; evidence for adjuvant therapy after upfront surgery is weak ※', ''],
      [x => /SCC/.test(x.label), 'SCC, T2 or higher or node-positive: neoadjuvant chemoRT then surgery, or definitive chemoRT. Japan: neoadjuvant docetaxel-cisplatin-FU', 'CROSS, NEOCRTEC5010, JCOG1109'],
      [() => true, 'Adenocarcinoma, T2 or higher or node-positive: perioperative FLOT, which outperformed CROSS', 'ESOPEC'],
    ],
  },
  gastric: {
    logic: 'T by wall layer: T3 subserosa, T4a serosa, T4b adjacent structure. N by count: 1–2, 3–6, 7–15, 16 or more',
    T: 'T1a lamina propria or muscularis mucosae · T1b submucosa · T2 muscularis propria · T3 subserosa · T4a serosa · T4b adjacent structure',
    N: 'N1 1–2 nodes · N2 3–6 · N3a 7–15 · N3b 16 or more. At least 16 nodes should be examined',
    M: 'M1 distant, including positive peritoneal cytology',
    S: 'IA is T1 N0. Each step in T or N adds about half a stage. T4b or N3b is stage III',
    tx: [
      [x => x.t === 'Tis' || (x.t === 'T1a' && x.n === 'N0'), 'Endoscopic submucosal dissection if criteria are met', ''],
      [['IA'], 'Gastrectomy alone', ''],
      [['IB', 'IIA', 'IIB', 'IIIA', 'IIIB', 'IIIC'], 'Western practice, cT2 or higher or node-positive: perioperative FLOT, with durvalumab. Asian practice after D2 gastrectomy, pathological stage II–III: adjuvant CAPOX or S-1; docetaxel plus S-1 for stage III', 'FLOT4, MATTERHORN, CLASSIC, ACTS-GC, JACCRO GC-07'],
      [['IV'], 'Chemotherapy with nivolumab or pembrolizumab, by CPS. HER2-positive: trastuzumab and pembrolizumab. CLDN18.2-positive: zolbetuximab', 'CheckMate 649, KEYNOTE-811, SPOTLIGHT'],
    ],
  },
  colorectal: {
    logic: 'Through the muscularis propria is stage II; any positive node is stage III. T4 or N2 marks high-risk stage III. Rectal treatment is decided on MRI, not TNM alone',
    T: 'T1 submucosa · T2 muscularis propria · T3 pericolorectal fat · T4a visceral peritoneum or perforation · T4b adjacent organ',
    N: 'N1a 1 node · N1b 2–3 · N1c tumour deposits without positive nodes · N2a 4–6 · N2b 7 or more',
    M: 'M1a one organ · M1b more than one organ · M1c peritoneum',
    S: 'I T1–2 N0 · IIA T3 N0 · IIB T4a N0 · IIC T4b N0 · IIIA T1–2 N1 · IIIC T4b node-positive, T4a N2a, or T3–4a N2b · IVA, IVB, IVC follow M',
    tx: [
      [x => x.rectal && x.s === 'I' && x.t === 'T1', 'Rectal T1, low risk: local excision. Otherwise TME', ''],
      [x => x.rectal && /^(II|III)/.test(x.s), 'Rectal, staged on MRI (CRM, EMVI, height): total neoadjuvant therapy; watch and wait after clinical complete response; selected mid-rectal tumours can omit RT. dMMR: dostarlimab', 'RAPIDO, PRODIGE 23, OPRA, PROSPECT, Cercek 2022'],
      [['0', 'I'], 'Surgery alone', ''],
      [['IIA', 'IIB', 'IIC'], 'Colon, dMMR: no adjuvant chemotherapy. pMMR with high-risk features (T4, fewer than 12 nodes, perforation, obstruction, LVI or PNI): CAPOX or fluoropyrimidine; ctDNA can guide de-escalation', 'Sargent pooled analysis, DYNAMIC'],
      [x => /^III/.test(x.s) && (t4(x) || /N2/.test(x.n)), 'Colon, high-risk stage III (T4 or N2): FOLFOX or CAPOX for 6 months. cT4: consider neoadjuvant FOLFOX. dMMR: neoadjuvant nivolumab-ipilimumab', 'IDEA, MOSAIC, FOxTROT, NICHE-2'],
      [x => /^III/.test(x.s), 'Colon, low-risk stage III (T1–3 N1): CAPOX for 3 months', 'IDEA'],
      [M1, 'Resectable liver or lung metastases: resection, with or without perioperative FOLFOX. Otherwise systemic therapy by RAS, BRAF, MMR and sidedness', 'EORTC 40983'],
    ],
  },
  anal: {
    logic: 'T by size, 2 and 5 cm. T4 is invasion of an adjacent organ, not the sphincter. N by nodal basin',
    T: 'T1 ≤2 cm · T2 >2–5 · T3 >5 · T4 vagina, urethra or bladder, any size',
    N: 'N1a inguinal, mesorectal or internal iliac nodes · N1b external iliac nodes · N1c both',
    M: 'M1 distant',
    S: 'I T1 N0 · IIA T2 N0 · IIB T1–2 N1 · IIIA T3 any N · IIIB T4 N0 · IIIC T4 N1',
    tx: [
      [x => !M1(x), 'Mitomycin with 5-FU or capecitabine chemoRT. Assess response at 26 weeks before salvage abdominoperineal resection', 'ACT II'],
      [M1, 'Carboplatin-paclitaxel with retifanlimab', 'InterAACT, POD1UM-303'],
    ],
  },
  hcc: {
    logic: 'BCLC combines tumour burden, liver function and performance status, and each stage carries a treatment. Cancer-related ECOG 1–2 is stage C regardless of tumour size',
    S: '0 single ≤2 cm, preserved liver function, ECOG 0 · A single of any size, or 2–3 nodules each ≤3 cm, ECOG 0 · B multinodular beyond A, ECOG 0, no vascular invasion or spread · C portal vein invasion, extrahepatic spread, or cancer-related ECOG 1–2 · D end-stage liver function or ECOG 3–4',
    tx: [
      [['0'], 'Ablation. Resection if ablation is not suitable', 'BCLC 2022 (Reig, J Hepatol 2022)'],
      [['A'], 'Single nodule: resection if no clinically significant portal hypertension and an adequate remnant. 2–3 nodules ≤3 cm: transplant if eligible, otherwise ablation. No adjuvant therapy has shown durable benefit', 'BCLC 2022, IMbrave050 ※'],
      [['B'], 'Within extended transplant criteria: transplant. Well-defined nodules with preserved portal flow: TACE. Diffuse, infiltrative or extensive bilobar disease: systemic therapy', 'BCLC 2022'],
      [['C'], 'Atezolizumab-bevacizumab or durvalumab-tremelimumab. Sorafenib, lenvatinib or durvalumab if these are unsuitable', 'IMbrave150, HIMALAYA'],
      [['D'], 'Best supportive care. Child-Pugh C within Milan criteria without other contraindications: transplant assessment', 'BCLC 2022'],
    ],
  },
  pancreas: {
    logic: 'T by size, 2 and 4 cm. Arterial involvement is T4; venous involvement is not. N1 1–3 nodes, N2 4 or more. Treatment follows resectability',
    T: 'T1 ≤2 cm (T1a ≤0.5, T1b 0.5–1, T1c 1–2) · T2 >2–4 · T3 >4 · T4 coeliac axis, SMA or common hepatic artery',
    N: 'N1 1–3 nodes · N2 4 or more',
    M: 'M1 distant',
    S: 'IA T1 N0 · IB T2 N0 · IIA T3 N0 · IIB N1 · III N2 or T4 · IV M1',
    tx: [
      [x => t4(x) && !M1(x), 'Locally advanced: induction chemotherapy, with or without chemoRT; resect if it becomes resectable', ''],
      [x => !M1(x), 'Resection, then modified FOLFIRINOX for 6 months if fit, otherwise gemcitabine-capecitabine. Borderline resectable: neoadjuvant chemotherapy, with or without RT', 'PRODIGE 24, ESPAC-4, PREOPANC'],
      [M1, 'Modified FOLFIRINOX, NALIRIFOX or gemcitabine-nab-paclitaxel', 'PRODIGE 4, NAPOLI-3, MPACT'],
    ],
  },
  gallbladder: {
    logic: 'T by wall layer. T2 is split by side; the hepatic side carries the worse prognosis. N1 1–3 nodes, N2 4 or more',
    T: 'T1a lamina propria · T1b muscle · T2a perimuscular tissue on the peritoneal side · T2b hepatic side · T3 serosa, liver or one adjacent organ · T4 main portal vein, hepatic artery, or two or more organs',
    N: 'N1 1–3 nodes · N2 4 or more', M: 'M1 distant',
    S: 'I T1 · IIA T2a · IIB T2b · IIIA T3 · IIIB N1 · IVA T4 · IVB N2 or M1',
    tx: [[x => x.t === 'T1a', 'Cholecystectomy alone', ''], ...BIL_TX],
  },
  'cholangio-intrahepatic': {
    logic: 'T by size at 5 cm, then vascular invasion or multiple tumours. Any positive node is IIIB',
    T: 'T1a ≤5 cm · T1b >5 cm · T2 vascular invasion or multiple tumours · T3 visceral peritoneum · T4 extrahepatic structures',
    N: 'N1 regional nodes', M: 'M1 distant',
    S: 'IA T1a · IB T1b · II T2 · IIIA T3 · IIIB T4 or N1 · IV M1',
    tx: BIL_TX,
  },
  'cholangio-perihilar': {
    logic: 'T by depth: duct wall, fat, liver, unilateral vessel, then bilateral involvement. N1 1–3 nodes, N2 4 or more',
    T: 'T1 confined to the duct wall · T2a into surrounding fat · T2b into liver · T3 unilateral portal vein or hepatic artery branch · T4 main portal vein, common hepatic artery, or bilateral second-order ducts',
    N: 'N1 1–3 nodes · N2 4 or more', M: 'M1 distant',
    S: 'I T1 · II T2 · IIIA T3 · IIIB T4 · IIIC N1 · IVA N2 · IVB M1',
    tx: BIL_TX,
  },
  'cholangio-distal': {
    logic: 'T by depth of invasion, 5 and 12 mm. Arterial involvement is T4, as in pancreas',
    T: 'T1 <5 mm · T2 5–12 mm · T3 >12 mm · T4 coeliac axis, SMA or common hepatic artery',
    N: 'N1 1–3 nodes · N2 4 or more', M: 'M1 distant',
    S: 'I T1 N0 · IIA T1 N1 or T2 N0 · IIB T2 N1 or T3 · IIIA N2 · IIIB T4 · IV M1',
    tx: BIL_TX,
  },
  ampulla: {
    logic: 'T by depth: sphincter, duodenal wall, pancreas with a 0.5 cm cut-off, then arteries',
    T: 'T1a sphincter of Oddi · T1b duodenal submucosa · T2 duodenal muscularis propria · T3a pancreas ≤0.5 cm · T3b pancreas >0.5 cm, peripancreatic tissue or duodenal serosa · T4 coeliac axis, SMA or common hepatic artery',
    N: 'N1 1–3 nodes · N2 4 or more', M: 'M1 distant',
    S: 'IA T1a · IB T1b–T2 · IIA T3a · IIB T3b · IIIA N1 · IIIB T4 or N2 · IV M1',
    tx: [
      [x => !M1(x) && x.s !== '0', 'Pancreatoduodenectomy, then adjuvant gemcitabine or fluoropyrimidine by histological subtype', 'ESPAC-3 periampullary'],
      [['0'], 'Ampullectomy or resection', ''],
      [M1, 'Systemic therapy by subtype, pancreatobiliary or intestinal', ''],
    ],
  },
  'small-bowel': {
    logic: 'T by wall layer as in colon. N1 1–2 nodes, N2 3 or more',
    T: 'T1a lamina propria · T1b submucosa · T2 muscularis propria · T3 subserosa · T4 serosa or adjacent organ',
    N: 'N1 1–2 nodes · N2 3 or more', M: 'M1 distant',
    S: 'I T1–2 N0 · IIA T3 · IIB T4 · IIIA N1 · IIIB N2 · IV M1',
    tx: [
      [x => /^III/.test(x.s), 'Adjuvant FOLFOX or CAPOX, extrapolated from colon ※', ''],
      [x => !M1(x), 'Resection. Adjuvant chemotherapy for high-risk stage II is extrapolated from colon ※', ''],
      [M1, 'FOLFOX or CAPOX', ''],
    ],
  },
  appendix: {
    logic: 'T and N as in colon, with histology added: low-grade mucinous peritoneal disease stays IVA',
    T: 'Wall layers as in colon. T4a visceral peritoneum, including mucin or cells on the serosa · T4b adjacent organ',
    N: 'N1 1–3 nodes · N2 4 or more',
    M: 'M1a acellular mucin only · M1b intraperitoneal tumour cells · M1c beyond the peritoneum',
    S: 'I T1–2 · IIA T3 · IIB T4a · IIC T4b · IIIA–C by N · IVA M1a, or M1b low-grade mucinous · IVB other M1b · IVC M1c',
    tx: [
      [x => /^III/.test(x.s), 'Right hemicolectomy, then adjuvant chemotherapy as for colon', ''],
      [x => /^IV[AB]/.test(x.s), 'Peritoneal disease: cytoreductive surgery with or without HIPEC in a specialist centre', ''],
      [x => !M1(x), 'Appendicectomy or right hemicolectomy, by histology and margin', ''],
      [() => true, 'Systemic therapy as for colorectal cancer', ''],
    ],
  },
  'net-pancreas': NET, 'net-gastric': NET, 'net-duodenal': NET, 'net-jejunoileal': NET, 'net-colonic': NET,
  'net-rectal': Object.assign({}, NET, { tx: [[x => !M1(x) && x.t === 'T1', 'G1 under 1 cm: endoscopic resection. 1–2 cm: EUS or MRI, then local excision', ''], ...NET_TX] }),
  'net-appendiceal': Object.assign({}, NET, { tx: [[x => !M1(x) && x.t === 'T1', '≤2 cm: appendicectomy alone', ''], [x => !M1(x), '>2 cm, mesoappendiceal invasion, LVI or N1: right hemicolectomy', ''], ...NET_TX.slice(1)] }),
  'net-gep': {
    logic: 'Differentiation first, then Ki-67: well-differentiated G1, G2 or G3, or poorly differentiated NEC',
    S: 'G1 Ki-67 <3% · G2 3–20% · G3 >20%, well differentiated · NEC poorly differentiated, small or large cell',
    tx: [
      [['G1', 'G2'], 'Localised: resection. Metastatic: somatostatin analogue; PRRT if SSTR-positive midgut; everolimus', 'CLARINET, PROMID, NETTER-1, RADIANT-4'],
      [['G3'], 'CAPTEM. PRRT if SSTR-positive', 'NETTER-2'],
      [['NEC'], 'Platinum-etoposide. Localised: surgery or chemoRT with platinum-etoposide', ''],
    ],
  },
  breast: {
    logic: 'T by size, 2 and 5 cm. N by count: 1–3, 4–9, 10 or more. Treatment is decided by subtype first, then stage and residual disease',
    T: 'T1 ≤2 cm (T1mi ≤0.1, T1a ≤0.5, T1b ≤1, T1c ≤2) · T2 ≤5 · T3 >5 · T4a chest wall, not pectoralis alone · T4b skin ulceration, oedema or satellite nodules · T4c both · T4d inflammatory',
    N: 'pN1mi >0.2–2 mm · pN1 1–3 nodes · pN2 4–9, or internal mammary alone · pN3 10 or more, infraclavicular, or supraclavicular. cN1 mobile level I–II · cN2 fixed or matted, or internal mammary alone · cN3 infraclavicular, internal mammary plus axillary, or supraclavicular',
    M: 'M1 distant',
    S: 'IA T1 N0 · IB T0–1 N1mi · IIA T0–1 N1 or T2 N0 · IIB T2 N1 or T3 N0 · IIIA N2, or T3 N1 · IIIB T4 N0–2 · IIIC N3 · IV M1',
    tx: [
      [['0'], 'DCIS: breast conservation with RT, with or without endocrine therapy, or mastectomy', ''],
      [['IA', 'IB'], 'HR-positive: endocrine therapy; chemotherapy by recurrence score (benefit at RS 16–25 if 50 or younger). HER2-positive T1 N0: paclitaxel-trastuzumab. Triple-negative T1 N0: chemotherapy; T1c N1: neoadjuvant pembrolizumab-chemotherapy (KEYNOTE-522 excluded T1c N0)', 'TAILORx, APT, KEYNOTE-522'],
      [['IIA', 'IIB', 'IIIA', 'IIIB', 'IIIC'], 'HR-positive: endocrine therapy, chemotherapy by recurrence score (postmenopausal N1 with RS ≤25: none); abemaciclib if 4 or more nodes, or 1–3 with grade 3 or ≥5 cm; ribociclib for stage II–III; ovarian suppression if premenopausal; olaparib if germline BRCA. HER2-positive: neoadjuvant chemotherapy with trastuzumab-pertuzumab; residual disease: T-DM1. Triple-negative: neoadjuvant pembrolizumab-chemotherapy; residual disease: capecitabine, or olaparib if germline BRCA', 'RxPONDER, monarchE, NATALEE, SOFT/TEXT, KATHERINE, KEYNOTE-522, CREATE-X, OlympiA'],
      [['IV'], 'Systemic therapy by subtype', ''],
    ],
  },
  'oral-cavity': {
    logic: 'T by size (2 and 4 cm) and depth of invasion (5 and 10 mm). N by size (3 and 6 cm), side and ENE',
    T: 'T1 ≤2 cm and DOI ≤5 mm · T2 ≤2 cm with DOI >5 mm, or 2–4 cm with DOI ≤10 mm · T3 2–4 cm with DOI >10 mm, or >4 cm with DOI ≤10 mm · T4a >4 cm with DOI >10 mm, cortical bone, maxillary sinus or skin · T4b masticator space, pterygoid plates, skull base, or carotid encasement',
    N: HN_N, M: 'M1 distant', S: HN_S, tx: HN_TX,
  },
  'oropharynx-p16neg': {
    logic: 'T by size, 2 and 4 cm, then named structures. N as for other non-viral head and neck sites',
    T: 'T1 ≤2 cm · T2 2–4 · T3 >4 cm, or lingual surface of the epiglottis · T4a larynx, extrinsic tongue muscle, medial pterygoid, hard palate or mandible · T4b lateral pterygoid, pterygoid plates, nasopharynx, skull base or carotid',
    N: HN_N, M: 'M1 distant', S: HN_S, tx: HN_TX,
  },
  hypopharynx: {
    logic: 'T by number of subsites and size (2 and 4 cm). Hemilarynx fixation is T3',
    T: 'T1 one subsite and ≤2 cm · T2 more than one subsite, or 2–4 cm, without fixation · T3 >4 cm, hemilarynx fixation, or oesophageal mucosa · T4a thyroid or cricoid cartilage, hyoid, thyroid gland, or central compartment soft tissue · T4b prevertebral fascia, carotid, or mediastinum',
    N: HN_N, M: 'M1 distant', S: HN_S, tx: HN_TX,
  },
  larynx: {
    logic: 'T by number of subsites and cord mobility. Invasion through the outer thyroid cartilage is T4a',
    T: 'T1 one subsite, mobile cord · T2 adjacent subsite or impaired mobility · T3 fixed cord, paraglottic or pre-epiglottic space, or inner cortex of thyroid cartilage · T4a through the outer cortex, trachea, or neck soft tissue · T4b prevertebral space, carotid, or mediastinum',
    N: HN_N, M: 'M1 distant', S: HN_S,
    tx: [
      HN_TX[0], HN_TX[1],
      [['III', 'IVA', 'IVB'], 'Larynx preservation with concurrent cisplatin-RT. T4a with cartilage destruction: total laryngectomy, then adjuvant RT or chemoRT', 'RTOG 91-11'],
      HN_TX[3],
    ],
  },
  sinonasal: {
    logic: 'Maxillary sinus T by wall and bone involvement: mucosa, bone erosion, posterior wall or orbital floor, anterior orbit or skull base',
    T: 'Maxillary sinus: T1 mucosa only · T2 bone erosion, including hard palate or middle meatus · T3 posterior wall, orbital floor or medial wall, pterygoid fossa, or ethmoid sinuses · T4a anterior orbit, skin, pterygoid plates, cribriform plate, sphenoid or frontal sinus · T4b orbital apex, dura, brain, clivus, or cranial nerves other than V2',
    N: HN_N, M: 'M1 distant', S: HN_S, tx: HN_TX,
  },
  'oropharynx-p16pos': {
    logic: 'HPV-mediated disease: nodal disease adds little to stage. T4 is not subdivided',
    T: 'T0 p16-positive node with no primary found · T1 ≤2 cm · T2 2–4 · T3 >4 cm, or lingual surface of the epiglottis · T4 larynx, extrinsic tongue muscle, medial pterygoid, hard palate, mandible or beyond',
    N: 'cN1 ipsilateral nodes ≤6 cm · cN2 contralateral or bilateral nodes ≤6 cm · cN3 node >6 cm (version 9 adds overt radiological ENE ※)',
    M: 'M1 distant',
    S: 'I T0–2 N0–1 · II T0–2 N2, or T3 N0–2 · III T4 or N3 · IV M1',
    tx: [
      [x => !M1(x), 'Cisplatin-RT, or transoral surgery with risk-adapted adjuvant therapy. De-escalation remains investigational; cetuximab is inferior to cisplatin', 'RTOG 1016, De-ESCALaTE'],
      [M1, 'Pembrolizumab alone or with platinum-FU, by CPS', 'KEYNOTE-048'],
    ],
  },
  nasopharyngeal: {
    logic: 'T follows the route of spread: soft tissue, then bone, then brain and cranial nerves. N3 is a node >6 cm, below the cricoid, or with advanced ENE',
    T: 'T1 nasopharynx, oropharynx or nasal cavity · T2 parapharyngeal space, medial or lateral pterygoid, or prevertebral muscles · T3 skull base, cervical vertebra, pterygoid structures, or paranasal sinuses · T4 intracranial extension, cranial nerves, hypopharynx, orbit, parotid, or beyond the lateral pterygoid',
    N: 'N1 unilateral cervical or retropharyngeal nodes ≤6 cm, above the cricoid · N2 bilateral nodes ≤6 cm, above the cricoid · N3 node >6 cm, below the cricoid, or advanced radiological ENE',
    M: 'M1a up to 3 metastatic lesions · M1b more than 3',
    S: 'IA T0–2 N0 · IB T0–2 N1 · II T0–2 N2, or T3 N0–2 · III T4 or N3 · IVA M1a · IVB M1b',
    tx: [
      [['0', 'IA'], 'RT alone', ''],
      [['IB', 'II'], 'RT, with concurrent cisplatin for higher-risk disease', ''],
      [['III'], 'Induction gemcitabine-cisplatin, then cisplatin-RT. High-risk residual disease: metronomic capecitabine', 'Zhang 2019, Chen 2021'],
      [['IVA', 'IVB'], 'Gemcitabine-cisplatin with a PD-1 inhibitor (toripalimab, camrelizumab). Oligometastatic responders: add locoregional RT', 'JUPITER-02, CAPTAIN-1st'],
    ],
  },
  salivary: {
    logic: 'T by size (2 and 4 cm) and extraparenchymal extension. Grade decides treatment',
    T: 'T1 ≤2 cm without extraparenchymal extension · T2 2–4 cm · T3 >4 cm or extraparenchymal extension · T4a skin, mandible, ear canal or facial nerve · T4b skull base, pterygoid plates or carotid',
    N: 'N1 one ipsilateral node ≤3 cm, no ENE · N2 larger, several, bilateral, or ENE', M: 'M1 distant',
    S: 'I T1 N0 · II T2 N0 · IIIA T3–4 N0, or T1–2 N1 · IIIB T3–4 N1, or N2 · IV M1',
    tx: [
      [x => !M1(x), 'Resection. PORT for high grade, T3–4, close or positive margin, PNI or positive nodes. Concurrent chemotherapy has no proven benefit', ''],
      [M1, 'Systemic therapy by histology and target (androgen receptor, HER2, NTRK)', ''],
    ],
  },
  thyroid: {
    logic: 'Age 55 divides the system. Under 55, only M1 reaches stage II. RAI decisions follow ATA risk, not stage',
    T: 'T1a ≤1 cm · T1b 1–2 · T2 2–4 · T3a >4 cm, intrathyroidal · T3b gross extension into strap muscles · T4a subcutaneous tissue, larynx, trachea, oesophagus or recurrent laryngeal nerve · T4b prevertebral fascia, carotid, or mediastinal vessels',
    N: 'N1a central compartment (levels VI–VII) · N1b lateral neck (levels I–V) or retropharyngeal',
    M: 'M1 distant',
    S: 'Under 55: I M0, II M1. 55 and over: I T1–2 N0 · II T1–2 N1, or T3 · III T4a · IVA T4b · IVB M1',
    tx: [
      [x => M1(x) || x.s === 'IVB', 'Total thyroidectomy and RAI. RAI-refractory: lenvatinib or sorafenib', 'SELECT, DECISION'],
      [() => true, 'ATA low risk: lobectomy, no RAI. Intermediate: selective RAI. High risk (gross extrathyroidal extension, incomplete resection, distant metastases): total thyroidectomy, RAI, TSH suppression', 'ATA 2015, HiLo, ESTIMABL2'],
    ],
  },
  prostate: {
    logic: 'Stage includes PSA and Grade Group. PSA ≥20 gives IIIA, cT3–4 gives IIIB, and Grade Group 5 gives IIIC, even when organ-confined',
    T: 'cT1 not palpable (cT1c found on PSA screening) · cT2a half of one lobe or less · cT2b more than half of one lobe · cT2c both lobes · cT3a extracapsular extension · cT3b seminal vesicle · cT4 fixed, or invading other structures',
    N: 'N1 regional pelvic nodes', M: 'M1a non-regional nodes · M1b bone · M1c other sites',
    S: 'I cT1–2a, PSA <10, GG1 · IIA PSA 10–20, or cT2b–c, with GG1 · IIB GG2 · IIC GG3–4 · IIIA PSA ≥20 · IIIB cT3–4 · IIIC GG5 · IVA N1 · IVB M1',
    tx: [
      [['I'], 'Low risk: active surveillance', 'ProtecT'],
      [['IIA', 'IIB'], 'Intermediate risk; NCCN group decides, not stage. Favourable: surveillance in selected patients, prostatectomy, or RT alone. Unfavourable (GG2 with 50% or more positive cores, or PSA 10–20): prostatectomy, or RT with 4–6 months ADT', ''],
      [['IIC'], 'Unfavourable intermediate risk: prostatectomy, or RT with 4–6 months ADT', ''],
      [['IIIA', 'IIIB', 'IIIC'], 'High or very high risk: RT with 18–36 months ADT; add abiraterone for very high risk. After prostatectomy: early salvage RT rather than adjuvant RT', 'STAMPEDE (Attard 2022), RADICALS-RT'],
      [['IVA'], 'Node-positive: RT with long-term ADT and abiraterone', 'STAMPEDE (Attard 2022)'],
      [['IVB'], 'ADT with an androgen receptor pathway inhibitor, with or without docetaxel. Low volume: add RT to the prostate', 'STAMPEDE arm H'],
    ],
  },
  bladder: {
    logic: 'Muscle invasion (T2) separates intravesical BCG from systemic therapy and cystectomy',
    T: 'Ta papillary, non-invasive · Tis carcinoma in situ · T1 lamina propria · T2a inner half of muscle · T2b outer half · T3a microscopic perivesical fat · T3b macroscopic · T4a prostatic stroma, uterus or vagina · T4b pelvic or abdominal wall',
    N: 'N1 one node in the true pelvis · N2 several · N3 common iliac nodes',
    M: 'M1a non-regional nodes · M1b other distant sites',
    S: '0a Ta · 0is Tis · I T1 · II T2 · IIIA T3–4a N0, or N1 · IIIB N2–3 · IVA T4b or M1a · IVB M1b',
    tx: [
      [['0a', '0is', 'I'], 'TURBT, then intravesical BCG for high grade, carcinoma in situ or T1. BCG-unresponsive: cystectomy, or bladder-sparing options', ''],
      [['II', 'IIIA', 'IIIB'], 'Neoadjuvant cisplatin-based chemotherapy, with perioperative durvalumab, then cystectomy; or trimodality therapy. Cisplatin-ineligible: perioperative enfortumab vedotin with pembrolizumab ※. Adjuvant nivolumab for ypT2 or higher, or node-positive', 'SWOG 8710, VESPER, NIAGARA, KEYNOTE-905 ※, CheckMate 274'],
      [['IVA', 'IVB'], 'Enfortumab vedotin with pembrolizumab', 'EV-302'],
    ],
  },
  utuc: {
    logic: 'T by layer as in bladder. Peripelvic fat or renal parenchyma is T3',
    T: 'Ta papillary, non-invasive · Tis carcinoma in situ · T1 subepithelial connective tissue · T2 muscularis · T3 peripelvic or periureteric fat, or renal parenchyma · T4 adjacent organs, or through the kidney into perinephric fat',
    N: 'N1 one node ≤2 cm · N2 node >2 cm, or several', M: 'M1 distant',
    S: '0a Ta · 0is Tis · I T1 · II T2 · III T3 · IV T4, node-positive, or M1',
    tx: [
      [['0a', '0is', 'I'], 'Nephroureterectomy, or kidney-sparing endoscopic treatment for low-risk disease', ''],
      [x => !M1(x), 'Nephroureterectomy, then adjuvant platinum chemotherapy for pT2 or higher or node-positive. Nivolumab is an alternative', 'POUT, CheckMate 274'],
      [M1, 'Enfortumab vedotin with pembrolizumab', 'EV-302'],
    ],
  },
  rcc: {
    logic: 'T by size (4, 7 and 10 cm), then venous involvement. Beyond Gerota fascia is T4',
    T: 'T1a ≤4 cm · T1b ≤7 · T2a ≤10 · T2b >10 · T3a renal vein or perinephric fat · T3b IVC below the diaphragm · T3c IVC above the diaphragm, or IVC wall · T4 beyond Gerota fascia, including contiguous adrenal',
    N: 'N1 regional nodes', M: 'M1 distant',
    S: 'I ≤7 cm · II >7 cm, confined · III T3 or N1 · IV T4 or M1',
    tx: [
      [['I'], 'Partial nephrectomy, ablation, or surveillance for small masses', ''],
      [['II'], 'Nephrectomy. Adjuvant pembrolizumab if pT2 with grade 4 or sarcomatoid features', 'KEYNOTE-564'],
      [x => !M1(x), 'Nephrectomy, then adjuvant pembrolizumab for 1 year', 'KEYNOTE-564'],
      [M1, 'Immunotherapy combination by IMDC risk. No evidence of disease after metastasectomy: pembrolizumab', 'KEYNOTE-564, CheckMate 9ER, CLEAR'],
    ],
  },
  testis: {
    logic: 'N by node size, 2 and 5 cm. S by markers after orchiectomy. IGCCCG group decides the number of cycles',
    T: 'pT1 testis or epididymis without LVI (seminoma pT1a <3 cm, pT1b ≥3 cm) · pT2 LVI, hilar soft tissue, epididymis, or tunica vaginalis · pT3 spermatic cord · pT4 scrotum',
    N: 'N1 node ≤2 cm, up to 5 nodes · N2 2–5 cm, or more than 5 nodes · N3 node >5 cm',
    M: 'M1a non-regional nodes or lung · M1b other sites',
    S: 'IA pT1 · IB pT2–4 · IS persistent markers · IIA–C by node size · IIIA M1a · IIIB S2 · IIIC S3 or M1b. S1: LDH <1.5 × ULN, hCG <5,000, AFP <1,000. S3: LDH >10 × ULN, hCG >50,000, AFP >10,000',
    tx: [
      [['0', 'IA', 'IB'], 'Surveillance. Options: one cycle of carboplatin for seminoma; one cycle of BEP for non-seminoma with LVI', ''],
      [['IS'], 'Treat as metastatic disease: BEP for 3 cycles', ''],
      [['IIA', 'IIB'], 'Seminoma: RT, or BEP for 3 cycles or EP for 4. Non-seminoma: BEP for 3 cycles, or RPLND', ''],
      [() => true, 'BEP by IGCCCG group: 3 cycles for good risk, 4 for intermediate or poor', 'IGCCCG'],
    ],
  },
  penile: {
    logic: 'T by depth: corpus spongiosum, then corpora cavernosa. N by number of inguinal nodes and fixation',
    T: 'Ta non-invasive verrucous · Tis penile intraepithelial neoplasia · T1a lamina propria without LVI, PNI or high grade · T1b with LVI, PNI or high grade · T2 corpus spongiosum · T3 corpora cavernosa · T4 adjacent structures',
    N: 'cN1 one mobile inguinal node · cN2 several, or bilateral, mobile nodes · cN3 fixed inguinal mass, or pelvic nodes',
    M: 'M1 distant',
    S: '0is Tis · 0a Ta · I T1a · IIA T1b–T2 · IIB T3 · IIIA N1 · IIIB N2 · IV T4, N3 or M1',
    tx: [
      [x => !M1(x) && x.n === 'N0', 'Organ-sparing surgery for low T. Inguinal staging by dynamic sentinel node biopsy from T1b', ''],
      [x => !M1(x), 'Bulky or fixed nodes: neoadjuvant TIP, then lymphadenectomy. pN2–3: adjuvant chemotherapy or chemoRT ※', 'InPACT ※'],
      [M1, 'Platinum-based chemotherapy', ''],
    ],
  },
  urethral: {
    logic: 'T by layer as in bladder. Corpus cavernosum, or beyond the prostatic capsule, is T3',
    T: 'Ta · Tis · T1 subepithelial connective tissue · T2 corpus spongiosum or periurethral muscle · T3 corpus cavernosum, beyond the prostatic capsule, anterior vagina, or bladder neck · T4 other adjacent organs',
    N: 'N1 one inguinal or true-pelvis node · N2 several', M: 'M1 distant',
    S: '0a Ta · 0is Tis · I T1 · II T2 · III T3 or N1 · IV T4, N2 or M1',
    tx: [
      [x => !M1(x), 'Surgery. Locally advanced: chemotherapy and RT, with or without surgery ※', ''],
      [M1, 'Platinum-based chemotherapy', ''],
    ],
  },
  adrenal: {
    logic: 'T by size at 5 cm, then local invasion and venous involvement',
    T: 'T1 ≤5 cm · T2 >5 cm · T3 invasion of surrounding fat · T4 adjacent organs, renal vein or IVC',
    N: 'N1 regional nodes', M: 'M1 distant',
    S: 'I T1 · II T2 · III T3–4 or N1 · IV M1',
    tx: [
      [x => !M1(x), 'R0 resection, then mitotane for high-risk disease (Ki-67 >10%, R1 margin, stage III). No benefit in low to intermediate risk', 'ADIUVO'],
      [M1, 'Etoposide, doxorubicin and cisplatin with mitotane', 'FIRM-ACT'],
    ],
  },
  melanoma: {
    logic: 'T by Breslow thickness: 0.8, 1, 2 and 4 mm. Ulceration adds the suffix b. Stage IIB and above qualify for adjuvant immunotherapy',
    T: 'T1a <0.8 mm without ulceration · T1b <0.8 mm with ulceration, or 0.8–1.0 mm · T2 >1–2 mm · T3 >2–4 mm · T4 >4 mm. Suffix b is ulcerated',
    N: 'N1 one node, or in-transit or satellite disease alone · N2 2–3 nodes, or one node with in-transit disease · N3 4 or more nodes, matted nodes, or 2 or more with in-transit disease',
    M: 'M1a skin, soft tissue or distant node · M1b lung · M1c other viscera · M1d CNS. Suffix (0) or (1) for LDH',
    S: 'IA T1a · IB T1b–T2a · IIA T2b–T3a · IIB T3b–T4a · IIC T4b · III any N · IV M1',
    tx: [
      [['0', 'IA', 'IB', 'IIA'], 'Wide excision. Sentinel node biopsy from T1b. No adjuvant therapy', ''],
      [['IIB', 'IIC'], 'Adjuvant pembrolizumab or nivolumab', 'KEYNOTE-716, CheckMate 76K'],
      [['III'], 'Adjuvant nivolumab or pembrolizumab; BRAF V600: dabrafenib-trametinib. Macroscopic nodal disease: neoadjuvant pembrolizumab, or nivolumab-ipilimumab. Completion dissection not needed after a positive sentinel node', 'CheckMate 238, KEYNOTE-054, COMBI-AD, SWOG S1801, NADINA, MSLT-II'],
      [['IV'], 'Nivolumab-ipilimumab or nivolumab-relatlimab. Resected stage IV: adjuvant nivolumab', 'CheckMate 067, RELATIVITY-047'],
    ],
  },
  merkel: {
    logic: 'T by size, 2 and 5 cm. T4 is invasion of fascia, muscle, cartilage or bone. Any positive node is stage III',
    T: 'T0 nodal disease with no primary · T1 ≤2 cm · T2 2–5 · T3 >5 · T4 fascia, muscle, cartilage or bone',
    N: 'N1 regional nodes · N2 in-transit disease without nodes · N3 in-transit disease with nodes',
    M: 'M1a skin, soft tissue or distant node · M1b lung · M1c other sites',
    S: 'I T1 N0 · IIA T2–3 N0 · IIB T4 N0 · III node-positive · IV M1',
    tx: [
      [x => !M1(x), 'Wide excision with sentinel node biopsy. RT to the bed or nodal basin by risk. Adjuvant immunotherapy is unproven ※', 'ADMEC-O ※, STAMP ※'],
      [M1, 'Avelumab or pembrolizumab', 'JAVELIN Merkel 200, KEYNOTE-017'],
    ],
  },
  'cutaneous-scc': {
    logic: 'T by size (2 and 4 cm), then high-risk features: PNI, depth >6 mm, bone involvement',
    T: 'T1 <2 cm · T2 2–4 · T3 ≥4 cm, minor bone erosion, PNI, or deep invasion (>6 mm or beyond subcutaneous fat) · T4a gross cortical or marrow invasion · T4b skull base or foramen',
    N: HN_N, M: 'M1 distant',
    S: 'I T1 N0 · II T2 N0 · III T3 N0, or T1–3 N1 · IV T4, N2–3 or M1',
    tx: [
      [['0', 'I', 'II'], 'Excision or Mohs surgery', ''],
      [x => !M1(x), 'Surgery with adjuvant RT for high-risk disease, then cemiplimab ※. Neoadjuvant cemiplimab is investigational', 'C-POST ※'],
      [M1, 'Cemiplimab', ''],
    ],
  },
  'soft-tissue-sarcoma': {
    logic: 'T by size: 5, 10 and 15 cm. Grade sets the stage. Any positive node is stage IV',
    T: 'T1 ≤5 cm · T2 5–10 · T3 10–15 · T4 >15',
    N: 'N1 regional nodes, stage IV', M: 'M1 distant',
    S: 'Grade 1: IA ≤5 cm, IB >5. Grade 2–3: II ≤5, IIIA 5–10, IIIB >10. N1 or M1: IV',
    tx: [
      [x => x.q && x.q.g === 'G1' && !M1(x) && x.n !== 'N1', 'Low grade: wide excision. RT if the margin is close', ''],
      [x => !M1(x) && x.n !== 'N1', 'Wide excision with preoperative RT. Adjuvant chemotherapy is unsettled; consider when predicted risk is high', "O'Sullivan, EORTC 62931, ISG-1001"],
      [() => true, 'Doxorubicin-based chemotherapy. Isolated nodal disease or oligometastases: resection in selected patients', ''],
    ],
  },
  'bone-sarcoma': {
    logic: 'T by size at 8 cm. A skip lesion is T3. Lung-only metastases are M1a',
    T: 'T1 ≤8 cm · T2 >8 cm · T3 discontinuous tumour (skip lesion) in the primary bone',
    N: 'N1 regional nodes', M: 'M1a lung · M1b other sites',
    S: 'Grade 1: IA ≤8 cm, IB >8 or skip lesion. Grade 2–3: IIA ≤8, IIB >8, III skip lesion. IVA M1a · IVB N1 or M1b',
    tx: [
      [x => x.q && x.q.g === 'G1' && !M1(x), 'Low grade, such as chondrosarcoma: wide excision alone', ''],
      [() => true, 'Osteosarcoma or Ewing sarcoma: perioperative chemotherapy at every stage, assuming micrometastatic disease', 'EURAMOS-1, Ewing 2012'],
    ],
  },
  cervix: {
    logic: 'Stage I by depth (3 and 5 mm) then size (2 and 4 cm). Positive nodes are stage IIIC under FIGO 2018',
    S: 'IA1 <3 mm depth · IA2 3–5 mm · IB1 <2 cm · IB2 2–4 · IB3 ≥4 · IIA upper two-thirds of vagina (IIA1 <4 cm, IIA2 ≥4) · IIB parametrium · IIIA lower third of vagina · IIIB pelvic wall or hydronephrosis · IIIC1 pelvic nodes, IIIC2 para-aortic nodes · IVA bladder or rectal mucosa · IVB distant',
    tx: [
      [['IA1'], 'Conisation or simple hysterectomy', ''],
      [['IA2', 'IB1', 'IB2', 'IIA1'], 'Open radical hysterectomy; simple hysterectomy for low-risk tumours ≤2 cm. Sedlis criteria: adjuvant RT. Peters criteria (positive nodes, margins or parametrium): adjuvant cisplatin-RT', 'LACC, SHAPE, GOG 92, GOG 109'],
      [['IB3', 'IIA2', 'IIB', 'IIIA', 'IIIB', 'IIIC1', 'IIIC2', 'IVA'], 'Cisplatin-RT with brachytherapy. Add pembrolizumab, or induction weekly carboplatin-paclitaxel', 'KEYNOTE-A18, INTERLACE'],
      [['IVB'], 'Carboplatin-paclitaxel with pembrolizumab, with or without bevacizumab', 'KEYNOTE-826'],
    ],
  },
  endometrial: {
    logic: 'FIGO 2023 combines histology, LVSI and molecular class. POLE-mutated moves down; p53-abnormal moves up',
    S: 'IA1 non-aggressive, confined to polyp or endometrium · IA2 <50% myometrium · IA3 low grade with ovarian involvement · IB ≥50% myometrium · IC aggressive histology without myometrial invasion · IIA cervical stroma · IIB substantial LVSI · IIC aggressive histology with myometrial invasion · IIIA adnexa or serosa · IIIB vagina, parametria or pelvic peritoneum · IIIC1 pelvic nodes, IIIC2 para-aortic · IVA bladder or bowel mucosa · IVB abdominal peritoneum · IVC distant. POLEmut I–II: IAm. p53abn with myometrial invasion: IICm',
    tx: [
      [['IAmPOLEmut'], 'POLE-mutated: no adjuvant therapy', 'PORTEC-3 molecular analysis'],
      [['IICmp53abn', 'IC', 'IIC'], 'Aggressive histology or p53-abnormal: chemotherapy, with or without RT', 'PORTEC-3'],
      [['IA1', 'IA2', 'IA3'], 'Hysterectomy. Observation or vaginal brachytherapy by risk', 'PORTEC-2'],
      [['IB'], 'Vaginal brachytherapy for high-intermediate risk', 'PORTEC-2'],
      [['IIA', 'IIB'], 'External beam RT, with or without brachytherapy', 'PORTEC-3'],
      [() => true, 'Carboplatin-paclitaxel with a PD-(L)1 inhibitor; greatest gain in dMMR. Durvalumab, with or without olaparib', 'RUBY, NRG-GY018, DUO-E'],
    ],
  },
  ovarian: {
    logic: 'Stage by extent: capsule, pelvis, abdomen with a 2 cm cut-off, then pleura or parenchyma',
    S: 'IA one ovary · IB both · IC1 surgical spill, IC2 rupture before surgery or surface involvement, IC3 positive cytology · IIA uterus or tubes · IIB other pelvic tissue · IIIA1 retroperitoneal nodes only, IIIA2 microscopic peritoneal disease · IIIB peritoneal deposits ≤2 cm · IIIC >2 cm · IVA pleural effusion · IVB parenchymal or extra-abdominal',
    tx: [
      [['IA', 'IB'], 'Low grade: surgery alone. High grade: carboplatin-paclitaxel', 'ICON1 / ACTION'],
      [['IC1', 'IC2', 'IC3', 'IIA', 'IIB'], 'Carboplatin-paclitaxel', 'ICON1 / ACTION'],
      [() => true, 'Primary or interval cytoreduction with carboplatin-paclitaxel, with or without bevacizumab. PARP inhibitor maintenance by BRCA and HRD status. HIPEC at interval surgery', 'SOLO-1, PAOLA-1, PRIMA, OVHIPEC-1'],
    ],
  },
  vulvar: {
    logic: 'FIGO 2021: size at 2 cm and stromal invasion at 1 mm. Nodes by size at 5 mm, then extracapsular spread',
    S: 'IA ≤2 cm with stromal invasion ≤1 mm · IB larger or deeper · II lower third of urethra or vagina, or anus · IIIA upper urethra or vagina, bladder or rectal mucosa, or nodes ≤5 mm · IIIB nodes >5 mm · IIIC nodes with extracapsular spread · IVA fixed to bone, or fixed or ulcerated nodes · IVB distant',
    tx: [
      [['IA'], 'Wide local excision. No nodal staging', ''],
      [['IB', 'II'], 'Radical local excision with sentinel node biopsy (unifocal, <4 cm) or groin dissection. Node-positive: adjuvant RT or chemoRT', 'GROINSS-V'],
      [['IIIA', 'IIIB', 'IIIC', 'IVA'], 'ChemoRT, or surgery with adjuvant chemoRT', ''],
      [['IVB'], 'Platinum-based chemotherapy, with or without pembrolizumab', ''],
    ],
  },
  vaginal: {
    logic: 'Stage by extent: vaginal wall, subvaginal tissue, pelvic wall, then mucosa of adjacent organs',
    S: 'I vaginal wall · II subvaginal tissue · III pelvic wall · IVA bladder or rectal mucosa, or beyond the true pelvis · IVB distant',
    tx: [
      [['IVB'], 'Platinum-based chemotherapy', ''],
      [() => true, 'External beam RT with brachytherapy, with or without cisplatin. Surgery for small stage I tumours of the upper vagina', ''],
    ],
  },
  gtn: {
    logic: 'FIGO anatomical stage with the WHO score: 6 or less is low risk, 7 or more high risk, 13 or more ultra-high risk',
    S: 'I uterus · II other genital structures · III lungs · IV other distant sites',
    tx: [
      [['I', 'II', 'III'], 'Low risk (WHO score 6 or less): methotrexate or actinomycin D. High risk (7 or more): EMA-CO', ''],
      [['IV'], 'EMA-CO. Ultra-high risk (13 or more): induction low-dose etoposide-cisplatin first', ''],
    ],
  },
  'uterine-sarcoma': {
    logic: 'Stage I by size at 5 cm, then pelvis, abdomen, bladder or rectum',
    S: 'IA ≤5 cm · IB >5 cm · IIA adnexa · IIB other pelvic tissue · IIIA one abdominal site · IIIB more than one · IIIC nodes · IVA bladder or rectum · IVB distant',
    tx: [
      [['IA', 'IB', 'IIA', 'IIB'], 'Hysterectomy. No adjuvant therapy has shown benefit in uterine leiomyosarcoma', 'GOG 277'],
      [() => true, 'Doxorubicin-based chemotherapy, or gemcitabine-docetaxel', ''],
    ],
  },
  lymphoma: {
    logic: 'Lugano: number of nodal regions, then sides of the diaphragm, then extranodal disease. Bulk and B symptoms modify',
    S: 'I one nodal region · II two or more regions on the same side of the diaphragm · III both sides, or nodes above the diaphragm with splenic involvement · IV non-contiguous extranodal disease',
    tx: [
      [['I', 'II'], 'Limited stage. DLBCL: R-CHOP for 4 cycles with 2 further rituximab doses (60 or younger, aaIPI 0, <7.5 cm), or R-CHOP for 3 cycles with PET-guided consolidation. Hodgkin: ABVD for 2–3 cycles with involved-site RT, PET-adapted', 'FLYER, S1001, HD16/HD17'],
      [['III', 'IV'], 'Advanced stage. DLBCL: Pola-R-CHP or R-CHOP for 6 cycles. Hodgkin: BrECADD, nivolumab-AVD, or brentuximab-AVD', 'POLARIX, HD21, S1826, ECHELON-1'],
    ],
  },
  glioma: {
    logic: 'WHO CNS5 classifies by IDH status first, then 1p/19q codeletion, then grade',
    S: 'Astrocytoma, IDH-mutant, grade 2–4 · Oligodendroglioma, IDH-mutant and 1p/19q-codeleted, grade 2–3 · Glioblastoma, IDH-wildtype, grade 4',
    tx: [
      [x => /Astrocytoma.*grade 2/.test(x.s), 'Maximal safe resection. Residual or recurrent disease: vorasidenib. High risk: RT with temozolomide', 'INDIGO'],
      [x => /Astrocytoma.*grade 3/.test(x.s), 'RT, then adjuvant temozolomide for 12 cycles', 'CATNON'],
      [x => /Astrocytoma.*grade 4/.test(x.s), 'RT with temozolomide', ''],
      [x => /Oligodendroglioma/.test(x.s), 'RT with PCV, for high-risk grade 2 and all grade 3', 'RTOG 9402, EORTC 26951, RTOG 9802'],
      [() => true, 'RT with temozolomide (Stupp), with or without tumour treating fields. Elderly: short-course RT with temozolomide', 'Stupp 2005, EF-14, Perry 2017'],
    ],
  },
};
const KEYMAP = { crc: 'colorectal', oral: 'oral-cavity', eso: 'esophageal' };
function get(siteId) { return SITES[KEYMAP[siteId] || siteId] || null; }
function txFor(d, x) {
  for (const r of d.tx || []) {
    const ok = typeof r[0] === 'function' ? r[0](x) : r[0].includes(x.s);
    if (ok) return { text: r[1], trials: r[2] };
  }
  return null;
}
window.Debrief = { get, txFor, SITES };
})();
