/* Clinical finding bank for vignette cases. Original wording, written as findings, not definitions.
   Syntax: alternatives split on ' | '; {a~b} decimal in (a,b]; {#a~b} integer; [[x;y;z]] pick one;
   {side}/{contra}; leading ♂/♀ limits a phrase to that sex. */
(function (G) {
'use strict';
const M0 = 'Staging CT of the chest, abdomen and pelvis shows no distant disease | PET-CT shows no distant metastasis | CT chest, abdomen and pelvis is clear of metastatic disease';
const M1 = 'CT shows [[three;several;multiple]] liver metastases | CT chest shows bilateral pulmonary nodules, biopsy-proven metastases | PET-CT shows bone metastases in the [[spine;pelvis;ribs]] | PET-CT shows liver and lung metastases';
const N0 = 'CT shows no regional lymphadenopathy | Regional nodes are not enlarged on CT and PET';
const HN_N = {
  N0: 'Neck CT and ultrasound show no suspicious nodes | Examination and CT show no cervical lymphadenopathy',
  N1: 'CT shows a single {side} level [[II;III]] node of {1.2~3.0} cm with no extranodal extension | There is a single mobile {side} level II node of {1.5~3.0} cm, and FNA is positive',
  N2: 'CT shows a single mobile {side} level II node of {3.2~6.0} cm without extranodal extension | CT shows [[two;three;four]] mobile {side} nodes at levels II–III, the largest {1.5~4.5} cm | CT shows bilateral mobile level II nodes, the largest {1.5~5.0} cm | CT shows a mobile contralateral level II node of {1.5~3.0} cm, and FNA is positive',
  N3: 'CT shows a {side} level II nodal mass of {6.2~8.5} cm | There is a {side} level II node of {2.0~5.0} cm fixed to the sternocleidomastoid with skin tethering and accessory nerve palsy'
};
const HN_M = { M0: 'CT chest shows no metastases | PET-CT shows no distant disease', M1: 'CT chest shows multiple bilateral lung metastases | PET-CT shows bone metastases in the spine' };
const COUNT_N = (a, b, c) => ({
  N0: 'All {#12~30} resected regional nodes are negative | {#14~28} regional nodes examined, none involved',
  N1: '{#' + a[0] + '~' + a[1] + '} of {#15~30} regional nodes contain metastatic carcinoma',
  N2: '{#' + b[0] + '~' + b[1] + '} of {#20~35} regional nodes contain metastatic carcinoma',
  N3: c ? '{#' + c[0] + '~' + c[1] + '} of {#30~45} regional nodes are involved' : null
});
const NET_M = { M0: M0, M1: 'Ga-68 DOTATATE PET shows multiple liver metastases | Ga-68 DOTATATE PET shows liver and bone metastases' };

const VB = {
  // ---------- Thoracic ----------
  mesothelioma: {
    intro: 'presents with breathlessness and a {side} pleural effusion, and thoracoscopic pleural biopsy shows epithelioid mesothelioma | has chest wall pain and a {side} pleural effusion, and pleural biopsy shows biphasic mesothelioma',
    T: {
      T1: 'CT shows pleural thickening. The maximal thicknesses at the three measured levels sum to {#4~12} mm, with no tumour in the fissures',
      T2: 'Summed maximal pleural thickness at the three CT levels is {#13~30} mm | Summed pleural thickness is {#5~12} mm, but tumour extends {#6~15} mm into the oblique fissure',
      T3: 'Summed maximal pleural thickness at the three CT levels is {#31~60} mm',
      T4: 'CT shows diffuse chest wall invasion with rib destruction | MRI shows tumour extending through the diaphragm into the peritoneum | Tumour invades the vertebral body | Tumour extends through the pericardium into the myocardium'
    },
    N: {
      N0: 'PET-CT shows no enlarged or FDG-avid nodes',
      N1: 'PET-CT shows an FDG-avid ipsilateral [[hilar;subcarinal;internal mammary;pericardial fat-pad]] node, EBUS positive',
      N2: 'EBUS confirms a contralateral mediastinal node | An FDG-avid ipsilateral supraclavicular node is FNA positive'
    },
    M: { M0: 'PET-CT shows no distant disease', M1: 'PET-CT shows liver and bone metastases | CT shows contralateral lung nodules, biopsy-proven mesothelioma' }
  },
  // ---------- GI ----------
  gastric: {
    intro: 'undergoes gastrectomy for adenocarcinoma of the [[antrum;body;lesser curve]] of the stomach | has a gastric adenocarcinoma resected by subtotal gastrectomy',
    T: {
      Tis: 'Pathology shows high-grade dysplasia confined to the epithelium',
      T1a: 'Pathology shows carcinoma confined to the mucosa, reaching the muscularis mucosae',
      T1b: 'Pathology shows carcinoma extending into the submucosa',
      T2: 'Pathology shows carcinoma infiltrating the muscularis propria',
      T3: 'Pathology shows carcinoma in the subserosal connective tissue, and the serosa is intact',
      T4a: 'Pathology shows carcinoma breaching the serosal surface',
      T4b: 'Carcinoma invades the [[pancreas;transverse colon;left lobe of the liver;spleen]]'
    },
    N: Object.assign(COUNT_N([1, 2], [3, 6]), { N3a: '{#7~15} of {#20~35} regional nodes contain metastatic carcinoma', N3b: '{#16~24} of {#30~45} regional nodes contain metastatic carcinoma' }),
    M: { M0: M0, M1: 'CT shows liver metastases | Laparoscopy shows peritoneal nodules, and biopsy is positive | A left supraclavicular node is FNA positive' }
  },
  anal: {
    intro: 'presents with anal bleeding, and biopsy shows squamous cell carcinoma of the anal canal',
    T: {
      T1: 'MRI shows a {0.8~2.0} cm tumour in the anal canal',
      T2: 'MRI shows a {2.2~5.0} cm tumour in the anal canal',
      T3: 'MRI shows a {5.2~8.0} cm tumour of the anal canal',
      T4: '♀ MRI shows a {2.5~7.0} cm tumour invading the posterior vaginal wall | ♂ MRI shows a {3.0~7.0} cm tumour invading the prostate | MRI shows a {3.0~7.0} cm tumour invading the urethra'
    },
    N: { N0: 'MRI and PET show no enlarged or FDG-avid nodes', N1: 'PET shows an FDG-avid {side} inguinal node | MRI shows an enlarged mesorectal node | PET shows FDG-avid {side} external iliac nodes' },
    M: { M0: 'PET-CT shows no distant disease', M1: 'PET-CT shows liver metastases | PET-CT shows para-aortic nodes and lung metastases' }
  },
  hcc: {
    intro: 'with cirrhosis has a liver lesion with arterial enhancement and washout on multiphase CT | with chronic hepatitis B has hepatocellular carcinoma on imaging and biopsy',
    T: {
      T1a: 'There is a single {1.0~2.0} cm lesion in segment [[II;IV;VI;VII]]',
      T1b: 'There is a single {2.2~9.0} cm lesion with no vascular invasion',
      T2: 'There is a single {2.5~8.0} cm lesion with microvascular invasion on resection | There are [[two;three]] lesions, the largest {2.0~5.0} cm',
      T3: 'There are [[two;three;four]] lesions, the largest {5.2~9.0} cm',
      T4: 'Tumour thrombus fills the right portal vein | Tumour thrombus extends into the middle hepatic vein | Tumour directly invades the diaphragm'
    },
    N: { N0: 'CT shows no enlarged hilar or periportal nodes', N1: 'PET-CT shows an FDG-avid hepatic hilar node of {1.5~3.0} cm' },
    M: { M0: 'CT chest and bone scan show no metastases', M1: 'CT chest shows multiple lung metastases | Bone scan shows a rib metastasis' }
  },
  pancreas: {
    intro: 'undergoes pancreatoduodenectomy for pancreatic adenocarcinoma | undergoes distal pancreatectomy for adenocarcinoma of the pancreatic tail',
    over: [
      { when: x => x.t === 'Tis', intro: 'undergoes pancreatoduodenectomy for a cystic lesion of the pancreatic head' },
      { when: x => x.t === 'T4' || /^M1/.test(x.m), intro: 'presents with painless jaundice, and EUS biopsy of a pancreatic head mass shows adenocarcinoma', N: { N0: 'CT shows no enlarged regional nodes', N1: 'CT shows [[one;two;three]] enlarged peripancreatic nodes, and EUS-FNA of one is positive', N2: 'CT shows [[four;five;six]] enlarged peripancreatic nodes, and EUS-FNA of one is positive' } }
    ],
    T: {
      Tis: 'The resection shows only high-grade PanIN with no invasion',
      T1: 'Pathology shows a {0.6~2.0} cm invasive carcinoma',
      T2: 'Pathology shows a {2.2~4.0} cm invasive carcinoma',
      T3: 'Pathology shows a {4.2~6.5} cm invasive carcinoma',
      T4: 'CT shows tumour encasing the superior mesenteric artery over 270° | CT shows a {2.0~4.0} cm tumour encasing the coeliac axis'
    },
    N: { N0: 'All {#12~25} resected nodes are negative', N1: '{#1~3} of {#15~28} resected nodes are positive', N2: '{#4~9} of {#18~30} resected nodes are positive' },
    M: { M0: M0, M1: 'CT shows multiple liver metastases | Laparoscopy shows peritoneal deposits, and biopsy is positive' }
  },
  gallbladder: {
    intro: 'has gallbladder adenocarcinoma found after cholecystectomy | undergoes radical cholecystectomy for gallbladder adenocarcinoma',
    T: {
      Tis: 'Pathology shows carcinoma in situ with no invasion',
      T1a: 'Carcinoma invades the lamina propria only',
      T1b: 'Carcinoma invades the muscle layer but not beyond',
      T2a: 'Carcinoma extends into the perimuscular connective tissue on the peritoneal side, and the serosa is intact',
      T2b: 'Carcinoma extends into the perimuscular connective tissue on the hepatic side, not into the liver',
      T3: 'Carcinoma invades {#5~15} mm into the liver bed | Carcinoma breaches the serosa | Carcinoma invades the duodenal wall',
      T4: 'Carcinoma encases the main portal vein | Carcinoma invades the liver, duodenum and transverse colon'
    },
    N: { N0: 'All {#6~12} resected nodes are negative', N1: '{#1~3} of {#6~12} regional nodes are positive', N2: '{#4~6} of {#8~14} regional nodes are positive' },
    M: { M0: M0, M1: 'CT shows liver metastases away from the gallbladder bed | Peritoneal nodules are biopsy positive' }
  },
  'cholangio-intrahepatic': {
    intro: 'has a liver mass, and biopsy shows intrahepatic cholangiocarcinoma',
    T: {
      Tis: 'Resection shows intraductal carcinoma with no invasion',
      T1a: 'There is a single {2.0~5.0} cm mass with no vascular invasion',
      T1b: 'There is a single {5.2~10.0} cm mass with no vascular invasion',
      T2: 'There is a single {2.0~8.0} cm mass with intrahepatic vascular invasion | There are [[two;three]] masses, the largest {2.0~6.0} cm',
      T3: 'A {4.0~9.0} cm mass breaches the liver capsule through the visceral peritoneum',
      T4: 'A {5.0~10.0} cm mass directly invades the [[diaphragm;duodenum;colon]]'
    },
    N: { N0: 'CT shows no enlarged hilar or periportal nodes', N1: 'A hepatoduodenal ligament node is biopsy positive' },
    M: { M0: M0, M1: 'CT shows bilateral lung metastases | Peritoneal nodules are biopsy positive' }
  },
  'cholangio-perihilar': {
    intro: 'undergoes resection for perihilar cholangiocarcinoma',
    over: [
      { when: x => x.t === 'Tis', intro: 'undergoes resection of a hilar biliary stricture' },
      { when: x => x.t === 'T4' || /^M1/.test(x.m), intro: 'presents with jaundice, and brushings from a hilar biliary stricture show adenocarcinoma',
        N: { N0: 'CT shows no enlarged regional nodes', N1: 'CT shows [[one;two;three]] enlarged hilar nodes, and EUS-FNA of one is positive', N2: 'CT shows [[four;five]] enlarged hilar and periportal nodes, and EUS-FNA of one is positive' } }
    ],
    T: {
      Tis: 'Resection shows high-grade dysplasia only',
      T1: 'Carcinoma is confined to the duct wall, up to the fibrous layer',
      T2a: 'Carcinoma extends beyond the duct wall into periductal fat',
      T2b: 'Carcinoma invades the adjacent liver parenchyma',
      T3: 'The tumour involves the right branch of the portal vein only | The tumour involves the left hepatic artery only',
      T4: 'CT shows tumour encasing the main portal vein | MRCP shows tumour extending to second-order ducts on both sides | CT shows tumour involving the common hepatic artery'
    },
    N: { N0: 'All {#8~16} resected nodes are negative', N1: '{#1~3} of {#8~16} regional nodes are positive', N2: '{#4~7} of {#10~18} regional nodes are positive' },
    M: { M0: M0, M1: 'CT shows liver metastases in the other lobe | Peritoneal nodules are biopsy positive' }
  },
  'cholangio-distal': {
    intro: 'undergoes pancreatoduodenectomy for distal bile duct adenocarcinoma',
    over: [
      { when: x => x.t === 'Tis', intro: 'undergoes pancreatoduodenectomy for a distal bile duct stricture' },
      { when: x => x.t === 'T4' || /^M1/.test(x.m), intro: 'presents with jaundice, and brushings from a distal bile duct stricture show adenocarcinoma', N: { N0: 'CT shows no enlarged regional nodes', N1: 'CT shows [[one;two;three]] enlarged peripancreatic nodes, and EUS-FNA of one is positive', N2: 'CT shows [[four;five;six]] enlarged peripancreatic nodes, and EUS-FNA of one is positive' } }
    ],
    T: {
      Tis: 'Pathology shows high-grade dysplasia with no invasion',
      T1: 'Carcinoma invades the bile duct wall to a depth of {1.0~4.9} mm',
      T2: 'Carcinoma invades the bile duct wall to a depth of {5.0~12.0} mm',
      T3: 'Carcinoma invades the bile duct wall to a depth of {12.2~18.0} mm',
      T4: 'CT shows tumour encasing the superior mesenteric artery | CT shows tumour encasing the common hepatic artery'
    },
    N: { N0: 'All {#12~25} resected nodes are negative', N1: '{#1~3} of {#12~25} resected nodes are positive', N2: '{#4~8} of {#15~28} resected nodes are positive' },
    M: { M0: M0, M1: 'CT shows liver metastases' }
  },
  'small-bowel': {
    intro: 'undergoes segmental resection for jejunal adenocarcinoma | has an ileal adenocarcinoma resected after presenting with obstruction',
    T: {
      Tis: 'Pathology shows high-grade dysplasia confined to the epithelium',
      T1a: 'Carcinoma invades the lamina propria only',
      T1b: 'Carcinoma invades the submucosa',
      T2: 'Carcinoma invades the muscularis propria',
      T3: 'Carcinoma extends through the muscularis propria into the subserosa, and the serosa is intact | Carcinoma extends into the mesentery without breaching the serosa',
      T4: 'Carcinoma breaches the serosal surface | Carcinoma invades an adjacent loop of bowel'
    },
    N: { N0: 'All {#8~20} resected nodes are negative', N1: '{#1~2} of {#10~20} resected nodes are positive', N2: '{#3~7} of {#12~22} resected nodes are positive' },
    M: { M0: M0, M1: 'CT shows liver metastases | Peritoneal nodules are biopsy positive' }
  },
  ampulla: {
    intro: 'presents with jaundice and undergoes pancreatoduodenectomy for ampullary adenocarcinoma',
    over: [
      { when: x => x.t === 'Tis', intro: 'undergoes ampullectomy for an ampullary adenoma' },
      { when: x => x.t === 'T4' || /^M1/.test(x.m), intro: 'presents with jaundice, and biopsy of an ampullary mass shows adenocarcinoma', N: { N0: 'CT shows no enlarged regional nodes', N1: 'CT shows [[one;two;three]] enlarged peripancreatic nodes, and EUS-FNA of one is positive', N2: 'CT shows [[four;five;six]] enlarged peripancreatic nodes, and EUS-FNA of one is positive' } }
    ],
    T: {
      Tis: 'Pathology shows high-grade dysplasia with no invasion',
      T1a: 'Carcinoma is confined to the ampulla',
      T1b: 'Carcinoma extends beyond the sphincter of Oddi into the duodenal submucosa',
      T2: 'Carcinoma invades the duodenal muscularis propria',
      T3a: 'Carcinoma invades {#1~5} mm into the pancreas',
      T3b: 'Carcinoma invades {#6~15} mm into the pancreas | Carcinoma reaches the duodenal serosa',
      T4: 'CT shows tumour encasing the superior mesenteric artery'
    },
    N: { N0: 'All {#12~25} resected nodes are negative', N1: '{#1~3} of {#12~25} resected nodes are positive', N2: '{#4~8} of {#15~28} resected nodes are positive' },
    M: { M0: M0, M1: 'CT shows liver metastases' }
  },
  appendix: {
    intro: 'undergoes right hemicolectomy for an appendiceal adenocarcinoma found at appendicectomy',
    T: {
      Tis: 'Pathology shows intramucosal carcinoma only',
      T1: 'Carcinoma invades the submucosa',
      T2: 'Carcinoma invades the muscularis propria',
      T3: 'Carcinoma extends into the mesoappendix',
      T4a: 'Carcinoma involves the serosal surface of the appendix',
      T4b: 'Carcinoma invades the [[caecal wall to the serosa;abdominal wall]] | ♀ Carcinoma invades the right ovary'
    },
    N: { N0: 'All {#12~25} resected nodes are negative', N1: '{#1~3} of {#12~25} resected nodes are positive', N2: '{#4~8} of {#15~28} resected nodes are positive' },
    M: {
      M0: 'CT and laparoscopy show no peritoneal or distant disease',
      M1a: 'Laparoscopy shows pools of mucin on the peritoneum, and histology shows acellular mucin only',
      M1b: 'Peritoneal deposits contain tumour cells',
      M1c: 'CT shows liver metastases | CT shows lung metastases'
    }
  },
  'net-pancreas': {
    intro: 'undergoes resection of a well-differentiated pancreatic neuroendocrine tumour',
    T: {
      T1: 'There is a {0.8~1.9} cm tumour in the pancreatic tail',
      T2: 'There is a {2.0~4.0} cm tumour confined to the pancreas',
      T3: 'There is a {4.2~7.0} cm tumour confined to the pancreas | There is a {1.5~3.5} cm tumour invading the duodenal wall',
      T4: 'There is a {3.0~8.0} cm tumour invading the [[stomach;spleen;splenic flexure of the colon]] | The tumour invades the wall of the superior mesenteric artery'
    },
    N: { N0: 'All {#8~16} resected nodes are negative', N1: '{#1~3} of {#8~16} resected nodes are positive' },
    M: { M0: 'Ga-68 DOTATATE PET shows no metastases', M1a: 'Ga-68 DOTATATE PET shows liver metastases only', M1b: 'Ga-68 DOTATATE PET shows bone metastases, and the liver is clear', M1c: 'Ga-68 DOTATATE PET shows liver and bone metastases' }
  },
  'net-gastric': {
    intro: 'has a well-differentiated gastric neuroendocrine tumour resected',
    T: {
      T1: 'There is a {0.4~1.0} cm tumour confined to the submucosa',
      T2: 'There is a {1.2~2.5} cm tumour in the submucosa | There is a {0.6~1.0} cm tumour invading the muscularis propria',
      T3: 'Tumour extends through the muscularis propria into the subserosa, and the serosa is intact',
      T4: 'Tumour breaches the serosa | Tumour invades the pancreas'
    },
    N: { N0: 'Resected nodes are negative', N1: '{#1~4} perigastric nodes are positive' },
    M: NET_M
  },
  'net-duodenal': {
    intro: 'has a well-differentiated duodenal neuroendocrine tumour',
    T: {
      T1: 'There is a {0.4~1.0} cm tumour confined to the mucosa and submucosa',
      T2: 'There is a {1.2~2.0} cm tumour in the submucosa | There is a {0.6~1.0} cm tumour invading the muscularis propria',
      T3: 'Tumour invades the pancreatic head',
      T4: 'Tumour breaches the serosa | Tumour invades the transverse colon'
    },
    N: { N0: 'Resected nodes are negative', N1: '{#1~3} regional nodes are positive' },
    M: NET_M
  },
  'net-jejunoileal': {
    intro: 'has a well-differentiated ileal neuroendocrine tumour resected after presenting with [[small bowel obstruction;abdominal pain;carcinoid syndrome]]',
    T: {
      T1: 'There is a {0.4~1.0} cm tumour confined to the submucosa',
      T2: 'There is a {1.2~2.0} cm tumour | Tumour invades the muscularis propria',
      T3: 'Tumour extends into the subserosa, and the serosa is intact',
      T4: 'Tumour breaches the serosa | Tumour invades an adjacent loop of bowel'
    },
    N: { N0: 'Resected mesenteric nodes are negative', N1: '{#1~8} of {#10~20} mesenteric nodes are positive', N2: 'A {2.5~5.0} cm mesenteric nodal mass encases the superior mesenteric vessels | {#12~18} of {#20~30} mesenteric nodes are positive' },
    M: NET_M
  },
  'net-appendiceal': {
    intro: 'has a well-differentiated neuroendocrine tumour found at appendicectomy',
    T: {
      T1: 'There is a {0.5~2.0} cm tumour at the tip of the appendix',
      T2: 'There is a {2.2~4.0} cm tumour',
      T3: 'There is a {4.2~5.5} cm tumour | There is a {1.0~2.0} cm tumour invading the mesoappendix',
      T4: 'Tumour perforates the peritoneum | Tumour invades the abdominal wall'
    },
    N: { N0: 'Resected nodes are negative', N1: '{#1~3} ileocolic nodes are positive at hemicolectomy' },
    M: NET_M
  },
  'net-rectal': {
    intro: 'has a well-differentiated rectal neuroendocrine tumour',
    T: {
      T1: 'There is a {0.4~2.0} cm tumour confined to the submucosa',
      T2: 'There is a {2.2~3.0} cm tumour confined to the submucosa | Tumour invades the muscularis propria',
      T3: 'Tumour extends through the muscularis propria into perirectal tissue',
      T4: '♂ Tumour invades the prostate | ♀ Tumour invades the posterior vaginal wall'
    },
    N: { N0: 'MRI shows no suspicious mesorectal nodes', N1: 'MRI shows two enlarged mesorectal nodes, positive at resection' },
    M: NET_M
  },
  'net-colonic': {
    intro: 'has a well-differentiated neuroendocrine tumour of the [[sigmoid;transverse;ascending]] colon',
    T: {
      T1: 'There is a {0.4~2.0} cm tumour confined to the submucosa',
      T2: 'There is a {2.2~3.0} cm tumour confined to the submucosa | Tumour invades the muscularis propria',
      T3: 'Tumour extends into the subserosa, and the serosa is intact',
      T4: 'Tumour breaches the serosa | Tumour invades the small bowel'
    },
    N: { N0: 'Resected nodes are negative', N1: '{#1~4} regional nodes are positive' },
    M: NET_M
  },
  // ---------- GU ----------
  rcc: {
    intro: 'has a {side} renal mass, and nephrectomy shows clear cell renal cell carcinoma | undergoes {side} nephrectomy for papillary renal cell carcinoma',
    T: {
      T1a: 'The tumour is {2.0~4.0} cm and confined to the kidney',
      T1b: 'The tumour is {4.2~7.0} cm and confined to the kidney',
      T2a: 'The tumour is {7.2~10.0} cm and confined to the kidney',
      T2b: 'The tumour is {10.5~15.0} cm and confined to the kidney',
      T3a: 'A {3.0~9.0} cm tumour invades the renal sinus fat | Tumour thrombus fills the renal vein | A {3.0~9.0} cm tumour invades perinephric fat within Gerota fascia',
      T3b: 'Tumour thrombus extends into the infrarenal IVC | Tumour thrombus extends into the IVC to the level of the hepatic veins, below the diaphragm',
      T3c: 'Tumour thrombus extends into the right atrium | Tumour thrombus extends above the diaphragm',
      T4: 'Tumour extends through Gerota fascia into the psoas | Tumour invades the {side} adrenal gland directly'
    },
    N: { N0: 'CT shows no enlarged retroperitoneal nodes', N1: 'An enlarged {side} hilar node is positive at nephrectomy | A {1.5~3.0} cm paracaval node is positive' },
    M: { M0: 'CT chest and bone scan show no metastases', M1: 'CT chest shows multiple lung metastases | A bone metastasis in the femur is biopsy positive' }
  },
  bladder: {
    intro: 'presents with painless haematuria, and TURBT and cystectomy show urothelial carcinoma | undergoes radical cystectomy for urothelial carcinoma',
    T: {
      Ta: 'There is a papillary tumour with no invasion of the lamina propria',
      Tis: 'Pathology shows flat carcinoma in situ only',
      T1: 'Tumour invades the lamina propria, and the muscularis propria is free',
      T2a: 'Tumour invades the inner half of the muscularis propria',
      T2b: 'Tumour invades the outer half of the muscularis propria',
      T3a: 'Tumour extends into perivesical fat on microscopy only',
      T3b: 'There is a gross extravesical mass in the perivesical fat',
      T4a: '♂ Tumour invades the prostatic stroma | ♀ Tumour invades the anterior vaginal wall | ♀ Tumour invades the uterus',
      T4b: 'Tumour invades the pelvic side wall | Tumour invades the anterior abdominal wall'
    },
    N: { N0: 'All {#12~30} pelvic nodes are negative', N1: 'One {side} obturator node of {#12~30} is positive | One {side} external iliac node is positive', N2: '[[Two;Three;Four]] {side} internal and external iliac nodes are positive', N3: 'A {side} common iliac node is positive' },
    M: { M0: M0, M1a: 'PET-CT shows para-aortic nodes, and biopsy is positive', M1b: 'CT shows lung metastases | PET-CT shows bone metastases' }
  },
  prostate: {
    sex: 'M', intro: 'has prostate adenocarcinoma | is diagnosed with prostate cancer',
    T: {
      cT1a: 'Carcinoma was found incidentally in 3% of TURP chips. DRE is normal',
      cT1b: 'Carcinoma was found incidentally in [[12;20;35]]% of TURP chips. DRE is normal',
      cT1c: 'DRE is normal. MRI-targeted biopsy was done for a raised PSA',
      cT2a: 'DRE shows a small nodule in less than half of the {side} lobe',
      cT2b: 'DRE shows a nodule occupying most of the {side} lobe, confined to that lobe',
      cT2c: 'DRE shows nodules in both lobes, confined to the gland',
      cT3a: 'DRE and MRI show {side} extraprostatic extension',
      cT3b: 'MRI shows tumour in the {side} seminal vesicle',
      cT4: 'MRI shows tumour invading the rectal wall | MRI shows tumour invading the external sphincter | MRI shows tumour invading the levator ani | The gland is fixed to the pelvic side wall'
    },
    N: { N0: 'PSMA PET shows no nodal disease', N1: 'PSMA PET shows {side} obturator and internal iliac nodes' },
    M: { M0: 'PSMA PET shows no distant disease', M1a: 'PSMA PET shows retroperitoneal para-aortic nodes', M1b: 'PSMA PET shows bone metastases in the spine and pelvis', M1c: 'PSMA PET shows lung metastases | CT shows liver metastases' }
  },
  testis: {
    sex: 'M', intro: 'presents with a painless testicular lump and undergoes radical inguinal orchiectomy for a germ cell tumour',
    T: {
      pTis: 'Pathology shows germ cell neoplasia in situ only',
      pT1: 'Tumour is confined to the testis, with no lymphovascular invasion',
      pT2: 'Tumour shows lymphovascular invasion | Tumour invades the epididymis | Tumour invades the tunica vaginalis',
      pT3: 'Tumour invades the spermatic cord',
      pT4: 'Tumour invades the scrotum'
    },
    N: {
      N0: 'CT shows no retroperitoneal nodes',
      N1: 'CT shows [[one;two;three]] para-aortic nodes, the largest {1.1~2.0} cm',
      N2: 'CT shows a {2.2~5.0} cm para-aortic nodal mass | CT shows [[six;seven;eight]] retroperitoneal nodes, each under 2 cm',
      N3: 'CT shows a {5.5~9.0} cm retroperitoneal nodal mass'
    },
    M: { M0: 'CT chest shows no metastases', M1a: 'CT chest shows multiple lung metastases | CT shows supraclavicular nodes', M1b: 'CT shows liver metastases | MRI shows brain metastases' }
  },
  utuc: {
    intro: 'presents with haematuria and undergoes nephroureterectomy for upper-tract urothelial carcinoma of the [[renal pelvis;ureter]]',
    T: {
      Ta: 'There is a papillary tumour with no invasion',
      Tis: 'Pathology shows flat carcinoma in situ only',
      T1: 'Tumour invades the subepithelial connective tissue',
      T2: 'Tumour invades the muscularis',
      T3: 'Tumour invades beyond the muscularis into peripelvic fat | Tumour invades the renal parenchyma | Tumour invades periureteric fat',
      T4: 'Tumour extends through the kidney into perinephric fat | Tumour invades the psoas'
    },
    N: { N0: 'Resected nodes are negative', N1: 'A single {1.0~2.0} cm hilar node is positive', N2: 'A single {2.2~4.0} cm retroperitoneal node is positive | [[Two;Three]] retroperitoneal nodes are positive' },
    M: { M0: M0, M1: 'CT shows lung metastases | PET-CT shows bone metastases' }
  },
  adrenal: {
    intro: 'has a {side} adrenal mass with cortisol excess, and adrenalectomy shows adrenocortical carcinoma',
    T: {
      T1: 'The tumour is {3.0~5.0} cm and confined to the adrenal',
      T2: 'The tumour is {5.5~12.0} cm and confined to the adrenal',
      T3: 'A {5.0~12.0} cm tumour invades periadrenal fat',
      T4: 'Tumour thrombus extends into the {side} renal vein | Tumour invades the IVC | Tumour invades the upper pole of the kidney'
    },
    N: { N0: 'CT shows no enlarged regional nodes', N1: 'A {1.5~3.0} cm periaortic node is positive' },
    M: { M0: M0, M1: 'CT shows lung metastases | CT shows liver metastases' }
  },
  penile: {
    sex: 'M', intro: 'has a lesion of the glans, and biopsy and penectomy show squamous cell carcinoma',
    T: {
      Tis: 'Pathology shows penile intraepithelial neoplasia only',
      Ta: 'Pathology shows non-invasive verrucous carcinoma',
      T1a: 'Tumour invades the lamina propria of the glans. It is low grade, with no lymphovascular or perineural invasion',
      T1b: 'Tumour invades the lamina propria of the glans with lymphovascular invasion | Tumour invades the lamina propria and is high grade',
      T2: 'Tumour invades the corpus spongiosum',
      T3: 'Tumour invades the corpus cavernosum',
      T4: 'Tumour invades the scrotum | Tumour invades the prostate'
    },
    N: {
      N0: 'Examination and imaging show no inguinal nodes',
      N1: 'One mobile {side} inguinal node is FNA positive',
      N2: '[[Three;Four]] {side} inguinal nodes are positive | Mobile inguinal nodes on both sides are FNA positive',
      N3: 'A {side} external iliac node is positive | An inguinal node shows extranodal extension'
    },
    M: { M0: 'CT shows no distant disease', M1: 'CT shows lung metastases | CT shows para-aortic nodes, and biopsy is positive' }
  },
  urethral: {
    intro: 'has urethral carcinoma on biopsy and resection',
    T: {
      Ta: 'There is a papillary tumour with no invasion',
      Tis: 'Pathology shows carcinoma in situ only',
      T1: 'Tumour invades the subepithelial connective tissue',
      T2: '♂ Tumour invades the corpus spongiosum | Tumour invades the periurethral muscle',
      T3: '♂ Tumour invades the corpus cavernosum | ♀ Tumour invades the anterior vaginal wall | Tumour invades the bladder neck',
      T4: 'Tumour invades the bladder wall | Tumour invades the pubic bone'
    },
    N: { N0: 'CT shows no enlarged inguinal or pelvic nodes', N1: 'A single {side} inguinal node is positive', N2: '[[Two;Three]] inguinal and pelvic nodes are positive' },
    M: { M0: M0, M1: 'CT shows lung metastases' }
  },
  // ---------- Skin ----------
  melanoma: {
    intro: 'has a pigmented lesion on the [[back;calf;upper arm;scalp]] excised, and pathology shows invasive melanoma',
    over: [
      { when: x => x.t === 'Tis', intro: 'has a pigmented lesion on the [[back;calf;upper arm;scalp]] excised', N: { N0: 'No regional nodes are palpable' } }
    ],
    T: {
      Tis: 'Pathology shows melanoma in situ only',
      T1a: 'Breslow thickness is 0.[[3;4;5;6;7]] mm with no ulceration',
      T1b: 'Breslow thickness is 0.[[4;5;6]] mm with ulceration | Breslow thickness is 0.[[8;9]] mm with no ulceration | Breslow thickness is 1.0 mm with ulceration',
      T2a: 'Breslow thickness is {1.1~2.0} mm with no ulceration',
      T2b: 'Breslow thickness is {1.1~2.0} mm with ulceration',
      T3a: 'Breslow thickness is {2.1~4.0} mm with no ulceration',
      T3b: 'Breslow thickness is {2.1~4.0} mm with ulceration',
      T4a: 'Breslow thickness is {4.1~9.0} mm with no ulceration',
      T4b: 'Breslow thickness is {4.1~9.0} mm with ulceration'
    },
    N: {
      N0: 'Sentinel node biopsy is negative',
      N1a: 'No nodes were palpable or seen on ultrasound before surgery, and one sentinel node is positive',
      N1b: 'A palpable {side} [[axillary;inguinal]] node is FNA positive, and dissection shows no other positive node',
      N1c: 'There is an in-transit metastasis, and sentinel node biopsy is negative | There is a satellite nodule, and sentinel node biopsy is negative',
      N2a: 'No nodes were palpable or seen on ultrasound before surgery, and [[two;three]] sentinel nodes are positive',
      N2b: 'A palpable {side} [[axillary;inguinal]] node is FNA positive, and dissection shows [[two;three]] positive nodes',
      N2c: 'There is an in-transit metastasis, and one sentinel node is positive | There is a satellite nodule, and one sentinel node is positive',
      N3a: 'No nodes were palpable or seen on ultrasound before surgery, and [[four;five;six]] sentinel nodes are positive',
      N3b: 'A palpable {side} [[axillary;inguinal]] node is FNA positive, and dissection shows [[four;five;six]] positive nodes | The {side} [[axillary;inguinal]] nodes are matted together, and FNA is positive',
      N3c: 'There are in-transit metastases, and [[two;three]] sentinel nodes are positive | There are satellite nodules, and dissection for a palpable node shows two positive nodes'
    },
    M: { M0: 'PET-CT and brain MRI show no distant disease', M1a: 'PET-CT shows distant subcutaneous nodules | PET-CT shows a distant non-regional nodal metastasis', M1b: 'PET-CT shows lung metastases only', M1c: 'PET-CT shows liver metastases | PET-CT shows adrenal and bone metastases', M1d: 'Brain MRI shows two cerebral metastases' }
  },
  merkel: {
    intro: 'is diagnosed with Merkel cell carcinoma',
    T: {
      T0: 'Full skin examination shows no primary skin lesion',
      T1: 'Excision of a red nodule on the [[cheek;forearm;thigh]] shows a {0.6~2.0} cm primary',
      T2: 'Excision of a red nodule on the [[cheek;forearm;thigh]] shows a {2.2~5.0} cm primary',
      T3: 'Excision of a mass on the [[thigh;buttock;back]] shows a {5.2~7.5} cm primary',
      T4: 'Excision of a nodule on the [[forearm;scalp;thigh]] shows invasion of the underlying [[fascia;muscle;bone]]'
    },
    N: {
      N0: 'Sentinel node biopsy is negative',
      'N1a(sn)': 'No nodes were palpable or seen on imaging before surgery, and one sentinel node is positive',
      N1a: 'No nodes were palpable or seen on imaging before surgery, and elective node dissection shows [[one;two]] positive nodes',
      N1b: 'A palpable {side} [[inguinal;axillary]] node is FNA positive, and dissection confirms nodal metastasis',
      N2: 'There is an in-transit metastasis between the primary and the nodal basin, and sentinel node biopsy is negative',
      N3: 'There is an in-transit metastasis, and a regional node is positive'
    },
    M: { M0: 'PET-CT shows no distant disease', M1a: 'PET-CT shows distant skin nodules | PET-CT shows distant non-regional nodes', M1b: 'PET-CT shows lung metastases', M1c: 'PET-CT shows liver metastases | PET-CT shows bone metastases' }
  },
  'cutaneous-scc': {
    intro: 'has a squamous cell carcinoma of the [[cheek;scalp;ear;temple]] excised',
    T: {
      Tis: 'Pathology shows SCC in situ only',
      T1: 'The tumour is {0.5~1.9} cm and {#2~5} mm deep, with no perineural invasion',
      T2: 'The tumour is {2.0~3.9} cm and {#2~5} mm deep, with no perineural invasion',
      T3: 'The tumour is {4.0~6.0} cm | A {1.0~3.0} cm tumour invades {#7~10} mm deep | A {1.0~3.0} cm tumour shows perineural invasion of a named nerve | A {1.5~3.0} cm tumour causes minor erosion of the outer table of the skull',
      T4a: 'CT shows tumour invading through the cortex into the marrow of the mandible',
      T4b: 'MRI shows tumour invading the skull base through the foramen ovale'
    },
    N: HN_N, M: HN_M
  },
  // ---------- H&N ----------
  nasopharyngeal: {
    intro: 'presents with a neck lump, and biopsy shows EBV-positive non-keratinising carcinoma | presents with epistaxis and nasal obstruction, and nasopharyngeal biopsy shows EBV-positive non-keratinising carcinoma | presents with unilateral hearing loss, and nasopharyngeal biopsy shows EBV-positive non-keratinising carcinoma',
    T: {
      T0: 'Endoscopy and MRI show no primary tumour in the nasopharynx',
      Tis: 'Biopsy shows carcinoma in situ only',
      T1: 'MRI shows tumour confined to the nasopharynx | MRI shows tumour extending into the nasal cavity, no parapharyngeal involvement',
      T2: 'MRI shows tumour extending into the parapharyngeal space | MRI shows tumour infiltrating the medial pterygoid muscle',
      T3: 'MRI shows tumour infiltrating the clivus | MRI shows tumour invading the sphenoid sinus | MRI shows erosion of the pterygoid plates',
      T4: 'MRI shows intracranial extension into the cavernous sinus | There is a {side} VI nerve palsy | MRI shows tumour extending into the orbit | MRI shows tumour invading the hypopharynx'
    },
    N: {
      N0: 'MRI shows no cervical or retropharyngeal nodes',
      N1: 'MRI shows a {side} level II node of {1.5~4.5} cm | MRI shows bilateral retropharyngeal nodes only',
      N2: 'MRI shows bilateral level II nodes, the largest {1.5~4.5} cm, above the cricoid',
      N3: 'MRI shows a {side} level II node of {6.2~8.0} cm | MRI shows a {side} level IV node below the cricoid | A {side} level II node invades the sternocleidomastoid'
    },
    M: { M0: 'PET-CT shows no distant disease', M1: 'PET-CT shows bone and liver metastases', M1a: 'PET-CT shows [[two;three]] bone metastases', M1b: 'PET-CT shows multiple bone and liver metastases, more than ten lesions' }
  },
  thyroid: {
    intro: 'has a thyroid nodule, and thyroidectomy shows papillary thyroid carcinoma | undergoes total thyroidectomy for follicular thyroid carcinoma',
    T: {
      T1a: 'The tumour is {0.4~1.0} cm and confined to the thyroid',
      T1b: 'The tumour is {1.1~2.0} cm and confined to the thyroid',
      T2: 'The tumour is {2.2~4.0} cm and confined to the thyroid',
      T3a: 'The tumour is {4.2~6.0} cm and confined to the thyroid',
      T3b: 'A {1.5~4.0} cm tumour grossly invades the strap muscles',
      T4a: 'Tumour invades the trachea | Tumour invades the recurrent laryngeal nerve | Tumour invades the oesophageal wall',
      T4b: 'Tumour encases the carotid artery | Tumour invades the prevertebral fascia'
    },
    N: { N0: 'Central and lateral neck nodes are negative', N1a: 'Central compartment level VI nodes are positive', N1b: '{side} level III and IV nodes are positive' },
    M: { M0: 'Post-ablation scan shows no uptake outside the neck', M1: 'Post-ablation scan shows diffuse lung uptake | CT shows bone metastases' }
  },
  'oropharynx-p16pos': {
    intro: 'presents with a neck lump, and biopsy shows p16-positive squamous cell carcinoma | presents with a sore throat, and biopsy of a [[tonsil;base of tongue]] mass shows p16-positive squamous cell carcinoma',
    T: {
      T0: 'No primary is found after examination under anaesthesia and PET',
      T1: 'Examination shows a {1.0~2.0} cm primary in the [[tonsil;base of tongue]]',
      T2: 'Examination shows a {2.2~4.0} cm primary in the [[tonsil;base of tongue]]',
      T3: 'Examination shows a {4.2~6.0} cm primary in the [[tonsil;base of tongue]] | A {2.0~3.5} cm base of tongue primary extends onto the lingual surface of the epiglottis',
      T4: 'The [[tonsil;base of tongue]] primary invades the larynx | The primary invades the medial pterygoid muscle | The primary invades the mandible'
    },
    N: {
      N0: 'Imaging shows no suspicious neck nodes',
      N1: 'There are {side} level II nodes, the largest {2.0~5.5} cm, with no radiological extranodal extension',
      N2: 'There are bilateral level II nodes, the largest {2.0~5.0} cm, with no radiological extranodal extension | A {side} level II node of {2.0~5.0} cm shows radiological extranodal extension',
      N3: 'There is a {side} level II nodal mass of {6.2~8.0} cm | There are bilateral nodes with radiological extranodal extension'
    },
    M: HN_M
  },
  'oropharynx-p16neg': {
    intro: 'has a p16-negative squamous cell carcinoma of the [[tonsil;base of tongue;soft palate]]',
    T: {
      Tis: 'Biopsy shows carcinoma in situ only',
      T1: 'The primary is {1.0~2.0} cm',
      T2: 'The primary is {2.2~4.0} cm',
      T3: 'The primary is {4.2~6.0} cm | A {2.0~3.5} cm primary extends onto the lingual surface of the epiglottis',
      T4a: 'The primary invades the larynx | The primary invades the medial pterygoid muscle | The primary invades the mandible',
      T4b: 'The primary invades the lateral pterygoid and pterygoid plates | The primary encases the internal carotid artery | The primary extends to the skull base'
    },
    N: HN_N, M: HN_M
  },
  larynx: {
    intro: 'presents with hoarseness, and biopsy shows laryngeal squamous cell carcinoma',
    T: {
      Tis: 'Biopsy shows carcinoma in situ only',
      T1: 'Tumour is limited to the {side} vocal cord, which moves normally | Tumour is limited to the epiglottis with normal cord mobility',
      T2: 'Tumour extends from the {side} vocal cord into the supraglottis | Tumour involves the {side} vocal cord, which is less mobile',
      T3: 'The {side} vocal cord is fixed | CT shows tumour in the pre-epiglottic space | CT shows tumour in the paraglottic space with erosion of the inner cortex of the thyroid cartilage',
      T4a: 'CT shows tumour through the outer cortex of the thyroid cartilage | Tumour extends into the strap muscles | Tumour invades the thyroid gland',
      T4b: 'CT shows tumour encasing the carotid artery | Tumour invades the prevertebral space'
    },
    N: HN_N, M: HN_M
  },
  hypopharynx: {
    intro: 'presents with dysphagia, and biopsy shows squamous cell carcinoma of the [[pyriform sinus;posterior pharyngeal wall;postcricoid region]]',
    T: {
      Tis: 'Biopsy shows carcinoma in situ only',
      T1: 'The tumour is {1.0~2.0} cm and limited to one subsite',
      T2: 'The tumour is {2.2~4.0} cm with normal laryngeal mobility | A {1.5~2.0} cm tumour involves two subsites with normal laryngeal mobility',
      T3: 'The tumour is {4.2~6.0} cm | The {side} hemilarynx is fixed | Tumour extends onto the oesophageal mucosa',
      T4a: 'CT shows tumour invading the thyroid cartilage | Tumour invades the thyroid gland | Tumour invades the hyoid bone',
      T4b: 'Tumour encases the carotid artery | Tumour invades the prevertebral fascia'
    },
    N: HN_N, M: HN_M
  },
  sinonasal: {
    intro: 'presents with nasal obstruction, and biopsy shows squamous cell carcinoma of the maxillary sinus',
    T: {
      Tis: 'Biopsy shows carcinoma in situ only',
      T1: 'CT shows tumour limited to the sinus mucosa with no bone erosion',
      T2: 'CT shows erosion of the hard palate | CT shows erosion of the medial wall into the middle meatus',
      T3: 'CT shows tumour through the posterior wall of the sinus | Tumour invades the floor of the orbit | Tumour extends into the ethmoid sinuses',
      T4a: 'Tumour invades the cheek skin | Tumour invades the pterygoid plates | Tumour extends into the anterior orbit',
      T4b: 'Tumour invades the orbital apex | MRI shows dural invasion | Tumour invades the nasopharynx'
    },
    N: HN_N, M: HN_M
  },
  salivary: {
    intro: 'has a {side} parotid mass, and parotidectomy shows [[mucoepidermoid carcinoma;adenoid cystic carcinoma;salivary duct carcinoma]]',
    T: {
      T1: 'The tumour is {1.0~2.0} cm and confined to the gland',
      T2: 'The tumour is {2.2~4.0} cm and confined to the gland',
      T3: 'The tumour is {4.2~6.0} cm | A {2.0~3.5} cm tumour grossly extends into periparotid soft tissue',
      T4a: 'Tumour invades the facial nerve | Tumour invades the overlying skin | Tumour invades the mandible',
      T4b: 'Tumour invades the skull base | Tumour encases the carotid artery'
    },
    N: { N0: 'Neck dissection shows no positive nodes', N1: '[[One;Two;Three]] neck nodes are positive with no extranodal extension', N2: '[[Four;Five;Six]] neck nodes are positive | One neck node is positive with extranodal extension' },
    M: HN_M
  },
  // ---------- Sarcoma ----------
  'soft-tissue-sarcoma': {
    intro: 'has a deep mass in the [[thigh;buttock;upper arm;chest wall]], and biopsy shows [[undifferentiated pleomorphic sarcoma;myxofibrosarcoma;leiomyosarcoma;synovial sarcoma]]',
    T: { T1: 'MRI shows a {2.0~5.0} cm mass', T2: 'MRI shows a {5.5~10.0} cm mass', T3: 'MRI shows a {10.5~15.0} cm mass', T4: 'MRI shows a {15.5~22.0} cm mass' },
    N: { N0: 'CT shows no enlarged regional nodes', N1: 'A regional node is biopsy positive' },
    M: { M0: 'CT chest shows no metastases', M1: 'CT chest shows multiple lung metastases' }
  },
  'bone-sarcoma': {
    intro: 'has bone pain, and biopsy of the [[distal femur;proximal tibia;proximal humerus]] shows osteosarcoma | has bone pain, and biopsy of the [[proximal femur;pelvis;proximal humerus]] shows chondrosarcoma',
    T: { T1: 'MRI shows a {3.0~8.0} cm tumour', T2: 'MRI shows a {8.5~15.0} cm tumour', T3: 'MRI shows a {4.0~9.0} cm tumour with a separate skip lesion in the same bone' },
    N: { N0: 'CT shows no enlarged regional nodes', N1: 'A regional node is biopsy positive' },
    M: { M0: 'CT chest and bone scan show no metastases', M1a: 'CT chest shows multiple lung metastases', M1b: 'Bone scan shows metastases in the spine and pelvis' }
  }
};

// Non-TNM sites: whole-case vignettes keyed by the answer; keys give the options in order
const VS = {
  cervix: { sex: 'F', title: 'FIGO', intro: 'has cervical squamous cell carcinoma | has cervical adenocarcinoma',
    S: {
      IA1: 'A cone biopsy shows invasion to a depth of {1.0~2.9} mm, and the margins are clear',
      IA2: 'A cone biopsy shows invasion to a depth of {3.0~4.9} mm, and the margins are clear',
      IB1: 'A cone biopsy shows invasion {#6~9} mm deep. MRI shows a {0.8~1.9} cm lesion with no residual disease beyond the cervix',
      IB2: 'MRI shows a {2.0~3.9} cm lesion confined to the cervix, and the nodes are negative',
      IB3: 'MRI shows a {4.0~6.0} cm lesion confined to the cervix, and the nodes are negative',
      IIA1: 'MRI shows a {2.0~3.9} cm lesion extending into the upper vagina. The parametria and nodes are clear',
      IIA2: 'MRI shows a {4.0~6.0} cm lesion extending into the upper vagina. The parametria and nodes are clear',
      IIB: 'MRI shows a {3.0~6.0} cm lesion with {side} parametrial invasion not reaching the pelvic wall. The nodes are negative',
      IIIA: 'Examination shows tumour extending to the lower third of the vagina. The parametria and nodes are clear',
      IIIB: 'MRI shows parametrial tumour reaching the {side} pelvic side wall | CT shows {side} hydronephrosis from parametrial tumour, and the nodes are negative',
      IIIC1: 'MRI shows a {2.0~5.0} cm lesion. PET shows {side} external iliac nodes, which are biopsy positive, and the para-aortic nodes are clear',
      IIIC2: 'PET shows FDG-avid para-aortic nodes below the renal vessels, which are biopsy positive',
      IVA: 'Cystoscopy shows tumour in the bladder mucosa, and biopsy is positive | Proctoscopy shows tumour in the rectal mucosa, and biopsy is positive',
      IVB: 'PET shows lung metastases | PET shows a left supraclavicular node, and biopsy is positive'
    } },
  ovarian: { sex: 'F', title: 'FIGO', intro: 'undergoes surgical staging for high-grade serous carcinoma | undergoes surgery for an adnexal mass, and histology shows clear cell carcinoma',
    S: {
      IA: 'Tumour involves the {side} ovary only. The capsule is intact, the surface is clear and washings are negative',
      IB: 'Tumour involves both ovaries. The capsules are intact, the surfaces are clear and washings are negative',
      IC1: 'Tumour is confined to the {side} ovary, but the capsule ruptured during surgery',
      IC2: 'The {side} ovarian capsule had ruptured before surgery | Tumour is on the surface of the {side} ovary',
      IC3: 'Tumour is confined to one ovary, and peritoneal washings contain malignant cells',
      IIA: 'Tumour involves the {side} ovary with implants on the uterine serosa',
      IIB: 'Tumour involves both ovaries with deposits on the pelvic sidewall peritoneum and sigmoid serosa',
      IIIA1: 'Tumour involves both ovaries, and the pelvic peritoneum is clear. A para-aortic node is positive',
      IIIA2: 'Omental biopsy shows microscopic tumour only, and no disease is visible above the pelvis',
      IIIB: 'Omental deposits up to {0.5~2.0} cm are seen above the pelvis',
      IIIC: 'There is an omental cake of {5.0~12.0} cm | Tumour is on the liver capsule with omental deposits of {3.0~6.0} cm',
      IVA: 'There is a {side} pleural effusion, and cytology is positive',
      IVB: 'CT shows liver parenchymal metastases | An inguinal node is positive | A supraclavicular node is biopsy positive'
    } },
  endometrial: { sex: 'F', title: 'FIGO 2023', intro: 'undergoes hysterectomy and staging for endometrial carcinoma',
    S: {
      IA1: 'Low-grade endometrioid carcinoma is confined to a polyp',
      IA2: 'Low-grade endometrioid carcinoma invades {#10~45}% of the myometrium, with no LVSI',
      IA3: 'Low-grade endometrioid carcinoma invades {#10~45}% of the myometrium, with a separate low-grade endometrioid carcinoma in the {side} ovary meeting criteria for synchronous primaries',
      IB: 'Low-grade endometrioid carcinoma invades {#55~90}% of the myometrium, with focal LVSI only',
      IC: 'Serous carcinoma is confined to a polyp, with no myometrial invasion. p53 was not tested',
      IIA: 'Low-grade endometrioid carcinoma invades the cervical stroma, with no LVSI',
      IIB: 'Low-grade endometrioid carcinoma invades {#20~45}% of the myometrium with substantial LVSI in {#6~15} vessels',
      IIC: 'Serous carcinoma invades {#10~60}% of the myometrium, with no LVSI. Molecular testing was not done',
      IIIA1: 'Endometrioid carcinoma has spread to the {side} fallopian tube',
      IIIA2: 'Carcinoma extends through the uterine serosa',
      IIIB1: 'Carcinoma involves the {side} parametrium | A vaginal metastasis is biopsy positive',
      IIIB2: 'Pelvic peritoneal nodules are biopsy positive',
      IIIC1: 'A {side} external iliac node contains a {#3~8} mm metastasis, and the para-aortic nodes are negative',
      IIIC2: 'A para-aortic node below the renal vessels contains a {#3~10} mm metastasis',
      IVA: 'Cystoscopy shows tumour in the bladder mucosa',
      IVB: 'Omental and upper abdominal peritoneal deposits are biopsy positive',
      IVC: 'CT shows lung metastases | A node above the renal vessels is positive',
      IAmPOLEmut: 'Endometrioid carcinoma invades {#55~90}% of the myometrium with substantial LVSI. A POLE mutation is detected',
      IICmp53abn: 'Endometrioid carcinoma invades {#10~40}% of the myometrium, and p53 is abnormal on IHC'
    } },
  vulvar: { sex: 'F', title: 'FIGO', intro: 'has vulvar squamous cell carcinoma excised',
    S: {
      IA: 'There is a {0.8~2.0} cm lesion with stromal invasion of 0.[[5;7;9]] mm, and the nodes are negative',
      IB: 'There is a {2.2~5.0} cm lesion with stromal invasion of {#2~6} mm, and the nodes are negative | There is a {1.0~2.0} cm lesion with stromal invasion of {#2~5} mm, and the nodes are negative',
      II: 'Tumour extends into the lower third of the vagina, and the nodes are negative | Tumour extends to the distal urethra, and the nodes are negative',
      IIIA: 'A single inguinal node contains a {#2~5} mm metastasis | Tumour extends to the upper vagina, and the nodes are negative',
      IIIB: 'An inguinal node contains a {#6~15} mm metastasis without extracapsular spread',
      IIIC: 'An inguinal node shows extracapsular spread',
      IVA: 'Inguinal nodes are fixed and ulcerated | Tumour is fixed to the pubic bone',
      IVB: 'CT shows lung metastases'
    } },
  vaginal: { sex: 'F', title: 'FIGO', intro: 'has primary vaginal squamous cell carcinoma',
    S: {
      I: 'Tumour is limited to the vaginal wall',
      II: 'MRI shows tumour in the paravaginal tissue, not reaching the pelvic wall',
      III: 'MRI shows tumour reaching the {side} pelvic side wall | There is {side} hydronephrosis from tumour',
      IVA: 'Cystoscopy shows tumour in the bladder mucosa',
      IVB: 'CT shows lung metastases'
    } },
  gtn: { sex: 'F', title: 'FIGO', intro: 'has a rising hCG after evacuation of a molar pregnancy',
    S: {
      I: 'Imaging shows disease confined to the uterus',
      II: 'Imaging shows a vaginal metastasis, and the chest is clear | There is an adnexal mass, and the chest is clear',
      III: 'CT chest shows [[three;several]] lung nodules',
      IV: 'MRI shows a brain metastasis | CT shows liver metastases'
    } },
  'uterine-sarcoma': { sex: 'F', title: 'FIGO', intro: 'undergoes hysterectomy for leiomyosarcoma of the uterus',
    S: {
      IA: 'Tumour is {2.0~5.0} cm and limited to the uterus',
      IB: 'Tumour is {5.5~12.0} cm and limited to the uterus',
      IIA: 'Tumour involves the {side} adnexa',
      IIB: 'Tumour extends to the pelvic side wall tissue',
      IIIA: 'There is a single omental deposit',
      IIIB: 'There are omental and mesenteric deposits',
      IIIC: 'Pelvic nodes are positive',
      IVA: 'Tumour invades the bladder',
      IVB: 'CT shows lung metastases'
    } },
  thymoma: { title: 'Masaoka–Koga', intro: 'has an anterior mediastinal mass resected, and histology shows type B2 thymoma',
    S: {
      I: 'The tumour is completely encapsulated',
      IIa: 'Microscopy shows tumour through the capsule',
      IIb: 'Tumour grossly invades the surrounding thymic fat | Tumour is adherent to the mediastinal pleura without invading it',
      III: 'Tumour invades the pericardium | Tumour invades the upper lobe of the lung | Tumour invades the brachiocephalic vein',
      IVa: 'There are pleural drop metastases | There are pericardial implants',
      IVb: 'There is a lung parenchymal metastasis | A mediastinal node is positive'
    } },
  lymphoma: { title: 'Lugano', intro: 'has diffuse large B-cell lymphoma and is staged with PET-CT | has classic Hodgkin lymphoma and is staged with PET-CT',
    S: {
      I: 'PET shows FDG-avid nodes in the {side} neck only | PET shows FDG-avid {side} inguinal nodes only',
      II: 'PET shows FDG-avid nodes in the {side} neck and mediastinum | PET shows {side} axillary and supraclavicular nodes',
      III: 'PET shows FDG-avid nodes in the neck and para-aortic region | PET shows mediastinal nodes and splenic deposits',
      IV: 'PET shows FDG-avid nodes in the neck with diffuse bone marrow uptake, and marrow biopsy is positive | PET shows mediastinal nodes and liver deposits'
    } },
  glioma: { title: 'WHO CNS5', intro: 'has a resected diffuse glioma',
    S: {
      'Astrocytoma, IDH-mutant, grade 2': 'The tumour is IDH1 R132H mutant with ATRX loss and intact 1p/19q. There are no mitoses, no necrosis and no CDKN2A/B deletion',
      'Astrocytoma, IDH-mutant, grade 3': 'The tumour is IDH1 R132H mutant with ATRX loss and intact 1p/19q. There are brisk mitoses, no necrosis, and CDKN2A/B is intact',
      'Astrocytoma, IDH-mutant, grade 4': 'The tumour is IDH1 R132H mutant with ATRX loss and intact 1p/19q, and has a homozygous CDKN2A/B deletion | The tumour is IDH1 mutant with ATRX loss, and shows necrosis and microvascular proliferation',
      'Oligodendroglioma, IDH-mutant, 1p/19q-codeleted, grade 2': 'The tumour is IDH1 mutant and 1p/19q codeleted, with ATRX retained and low mitotic activity',
      'Oligodendroglioma, IDH-mutant, 1p/19q-codeleted, grade 3': 'The tumour is IDH1 mutant and 1p/19q codeleted, with ATRX retained. There are brisk mitoses and microvascular proliferation',
      'Glioblastoma, IDH-wildtype, grade 4': 'The tumour is IDH wild-type with a grade 2 appearance, a TERT promoter mutation and +7/−10 | The tumour is IDH wild-type with necrosis and microvascular proliferation | The tumour is IDH wild-type with EGFR amplification'
    },
    D: {
      'Astrocytoma, IDH-mutant, grade 2': 'IDH-mutant, 1p/19q intact (often ATRX lost) · low mitotic activity · no necrosis, MVP or CDKN2A/B homozygous deletion',
      'Astrocytoma, IDH-mutant, grade 3': 'IDH-mutant, 1p/19q intact · significant mitotic activity · no necrosis, MVP or CDKN2A/B homozygous deletion',
      'Astrocytoma, IDH-mutant, grade 4': 'IDH-mutant, 1p/19q intact · necrosis or MVP, or CDKN2A/B homozygous deletion',
      'Oligodendroglioma, IDH-mutant, 1p/19q-codeleted, grade 2': 'IDH-mutant and 1p/19q-codeleted · no anaplastic features',
      'Oligodendroglioma, IDH-mutant, 1p/19q-codeleted, grade 3': 'IDH-mutant and 1p/19q-codeleted · brisk mitoses, MVP or necrosis',
      'Glioblastoma, IDH-wildtype, grade 4': 'IDH-wildtype diffuse astrocytic glioma with necrosis or MVP, or TERT promoter mutation, EGFR amplification or +7/−10'
    } },
  hcc: { only: true, title: 'BCLC', intro: 'has [[hepatitis B;hepatitis C;alcohol-related;MASLD-related]] cirrhosis. Surveillance ultrasound is abnormal, and multiphase MRI shows LI-RADS 5 disease',
    S: {
      '0': 'There is a single {#11~19} mm lesion with no vascular invasion and no extrahepatic disease. Bilirubin is {#9~22} µmol/L, albumin {#37~44} g/L, INR 1.{#0~2}, with no ascites or encephalopathy (Child-Pugh A5). ECOG performance status is 0',
      A: 'There is a single {#35~95} mm lesion with no vascular invasion. Staging CT of the chest is clear. Bilirubin is {#9~24} µmol/L, albumin {#36~43} g/L, with no ascites or encephalopathy (Child-Pugh A[[5;6]]). ECOG performance status is 0 | There are [[2;3]] lesions in the right lobe, the largest {#18~30} mm, with no vascular invasion or extrahepatic disease. Liver function is Child-Pugh A5. ECOG performance status is 0',
      B: 'There are [[4;5;6]] lesions in both lobes, the largest {#25~60} mm, with patent portal veins and no extrahepatic disease. Liver function is Child-Pugh A[[5;6]]. ECOG performance status is 0 | There are 3 lesions, the largest {#35~70} mm, with no vascular invasion and a clear staging CT of the chest. Liver function is Child-Pugh A5. ECOG performance status is 0',
      C: 'There is a single {#45~90} mm lesion with tumour thrombus in the [[right;left]] portal vein branch. Liver function is Child-Pugh A[[5;6]]. ECOG performance status is [[0;1]] | There are 2 liver lesions, the largest {#30~60} mm, and CT of the chest shows [[several pulmonary nodules;a lytic rib lesion;enlarged mediastinal nodes]] consistent with metastases. Liver function is Child-Pugh A5. ECOG performance status is 0 | There is a single {#30~50} mm lesion with no vascular invasion or extrahepatic disease. Liver function is Child-Pugh A5. Over 3 months the patient has lost {#6~10} kg, has right upper quadrant pain and now manages only light work. ECOG performance status is 1, attributed to the tumour',
      D: 'There is a single {#20~40} mm lesion. Bilirubin is {#60~110} µmol/L, albumin {#22~27} g/L, with refractory ascites and grade 2 encephalopathy (Child-Pugh C[[11;12;13]]). The transplant team has declined listing. ECOG performance status is 2 | There are multiple lesions in both lobes, the largest {#40~80} mm, with no vascular invasion. Liver function is Child-Pugh A6. The patient spends more than half the day in bed. ECOG performance status is 3'
    },
    D: {
      '0': 'Very early: single nodule ≤2 cm, preserved liver function, ECOG 0',
      A: 'Early: single nodule of any size, or 2–3 nodules each ≤3 cm · preserved liver function · ECOG 0',
      B: 'Intermediate: multinodular beyond stage A · preserved liver function · ECOG 0 · no vascular invasion or extrahepatic spread',
      C: 'Advanced: portal vein invasion or extrahepatic spread, or cancer-related ECOG 1–2 · preserved liver function',
      D: 'Terminal: end-stage liver function (non-transplantable) or ECOG 3–4, whatever the tumour burden'
    } },
  gist: { title: 'Recurrence risk', intro: 'undergoes complete resection of a gastrointestinal stromal tumour, with no tumour rupture',
    S: {
      None: 'The tumour is a {1.0~2.0} cm gastric GIST with {#1~4} mitoses per 50 HPF | The tumour is a {1.0~2.0} cm gastric GIST with {#6~12} mitoses per 50 HPF | The tumour is a {1.0~2.0} cm jejunal GIST with {#1~4} mitoses per 50 HPF',
      'Very low': 'The tumour is a {2.2~5.0} cm gastric GIST with {#1~5} mitoses per 50 HPF',
      Low: 'The tumour is a {5.5~10.0} cm gastric GIST with {#1~5} mitoses per 50 HPF | The tumour is a {2.2~5.0} cm jejunal GIST with {#1~5} mitoses per 50 HPF',
      Moderate: 'The tumour is a {2.2~5.0} cm gastric GIST with {#6~15} mitoses per 50 HPF | The tumour is a {10.5~15.0} cm gastric GIST with {#1~5} mitoses per 50 HPF | The tumour is a {5.5~10.0} cm ileal GIST with {#1~5} mitoses per 50 HPF',
      High: 'The tumour is a {5.5~10.0} cm gastric GIST with {#6~20} mitoses per 50 HPF | The tumour is a {2.2~5.0} cm ileal GIST with {#6~15} mitoses per 50 HPF | The tumour is a {10.5~15.0} cm jejunal GIST with {#1~5} mitoses per 50 HPF'
    },
    D: {
      None: 'Gastric ≤2 cm with any mitotic count, or nongastric ≤2 cm with ≤5 mitoses per 50 HPF',
      'Very low': 'Gastric >2–5 cm with ≤5 mitoses per 50 HPF',
      Low: 'Gastric >5–10 cm with ≤5 mitoses, or nongastric >2–5 cm with ≤5 mitoses per 50 HPF',
      Moderate: 'Gastric >2–5 cm with >5 mitoses, gastric >10 cm with ≤5 mitoses, or nongastric >5–10 cm with ≤5 mitoses per 50 HPF',
      High: 'Gastric >5 cm with >5 mitoses, nongastric >2 cm with >5 mitoses, or nongastric >10 cm with any mitotic count'
    } },
  'net-gep': { title: 'WHO grade', intro: 'has a pancreatic neuroendocrine neoplasm on biopsy | has an ileal neuroendocrine neoplasm resected',
    S: {
      G1: 'Morphology is well differentiated. The Ki-67 index is [[1;2]]%, with 1 mitosis per 2 mm²',
      G2: 'Morphology is well differentiated. The Ki-67 index is {#4~18}%, with {#2~10} mitoses per 2 mm²',
      G3: 'Morphology is well differentiated. The Ki-67 index is {#25~50}%',
      NEC: 'Morphology is poorly differentiated, of small cell type. The Ki-67 index is {#70~95}%'
    } }
};
G.DrillVB = { VB, VS, M0, M1, N0 };
})(typeof window !== 'undefined' ? window : globalThis);
