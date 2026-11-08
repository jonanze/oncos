#!/usr/bin/env python3
"""Generate sites.js for the Drill module from the Staging module's staging_data.json.

    python3 build_sites.py <staging_data.json> [out.js]

Run at every release (the kit's drill view build calls it), so the drill's tables
follow the Staging tables. Stage-group strings ("T1–T2", "Any N", "M1a / M1b") are
expanded over each site's category list; sites whose grouping needs qualifiers
(thyroid age, prostate PSA and Grade Group, testis S, sarcoma grade, appendix
histotype) are written out below. The hand systems (lung, colorectal, breast,
oral cavity, oesophagus) live in core.js.
"""
import json,re,itertools,copy,sys,os
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'staging_data.json')
OUT=sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'sites.js')
doc=json.load(open(SRC,encoding='utf-8'))
C=doc['cancers'] if isinstance(doc,dict) else doc
def _members(x,order):
    x=x.strip()
    return [o for o in order if o==x or (o.startswith(x) and re.fullmatch(r'[a-z0-9]+',o[len(x):] or '-') and o[len(x):]!='mi')]
def expand(spec,order):
    """Expand a stage-group cell over the ordered categories; returns (members, error)."""
    spec=spec.strip()
    if re.match(r'(?i)^any\b',spec): return list(order),False
    out=[]
    for part in re.split(r'\s*/\s*|\s*,\s*',spec):
        if '–' in part:
            a,b=part.split('–',1); A=_members(a,order); B=_members(b,order)
            if not A or not B: return out,True
            out+=order[order.index(A[0]):order.index(B[-1])+1]
        else:
            m=_members(part,order)
            if not m: return out,True
            out+=m
    return [o for o in order if o in out],False
HAND={'lung':['lung'],'colorectal':['crc'],'breast':['breast'],'oral-cavity':['oral'],'esophageal':['eso-c-scc','eso-c-ac','eso-p-scc','eso-p-ac','eso-yp']}
INSITU={'Tis','Ta','T0','pTis'}
SEC={'Gastrointestinal':'GI','Head & Neck':'H&N','Genitourinary':'GU','Gynaecological':'Gynae','Central Nervous System':'CNS','Thoracic':'Thoracic','Breast':'Breast','Skin':'Skin','Sarcoma':'Sarcoma','Lymphoma':'Lymphoma'}
def auto(c,T=None,N=None,M=None,groups=None,fixes=None):
    T=T or [x['cat'] for x in c['t']]; N=N or [x['cat'] for x in c['n']]; M=M or [x['cat'] for x in c['m']]
    rules=[]
    for g in (groups or c['stage_groups']):
        nspec=re.sub(r'\s+or\s+NX','',g['n'])
        tt,e1=expand(g['t'],T); nn,e2=expand(nspec,N); mm,e3=expand(g['m'],M)
        assert not(e1 or e2 or e3),(c['id'],g)
        rules.append([g['stage'],tt,nn,mm])
    return finish(c['id'],T,N,M,rules)
def finish(sid,T,N,M,rules,Q=None,label=None,short=None):
    def qm(rq,q): return rq is None or all(q[k] in v for k,v in rq.items())
    combos=[None]
    if Q:
        combos=[dict(zip(Q.keys(),vals)) for vals in itertools.product(*Q.values())]
    invalid=[]; probs=[]
    for t,n,m in itertools.product(T,N,M):
        hitsets=[[r[0] for r in rules if t in r[1] and n in r[2] and m in r[3] and qm(r[4] if len(r)>4 else None,q)] for q in combos]
        if all(len(h)==0 for h in hitsets) and t in INSITU and n!=N[0]: invalid.append([t,n,m]); continue
        if all(len(h)==0 for h in hitsets) and t in INSITU and (m!=M[0] or t=='T0'): invalid.append([t,n,m]); continue
        for q,h in zip(combos,hitsets):
            if len(set(h))!=1: probs.append((t,n,m,q,h))
    assert not probs,(sid,probs[:5])
    return dict(T=T,N=N,M=M,Q=Q,rules=rules,invalid=invalid)

CI={c['id']:c for c in C}
SYS={}; notes={}
for c in C:
    sid=c['id']
    if c['type']!='TNM' or sid in HAND or sid in('thyroid','gist','prostate','testis','soft-tissue-sarcoma','bone-sarcoma','appendix','mesothelioma','nasopharyngeal'): continue
    SYS[sid]=auto(c)
# mesothelioma: clinical T listed as cT1-cT4
m=CI['mesothelioma']; 
for x in m['t']: x['cat']=x['cat'][1:]
m['t_title']='Primary tumour — clinical (cT)'
SYS['mesothelioma']=auto(m)
# NPC: drop parent M1; Tis is stage 0 only
n=CI['nasopharyngeal']
g=copy.deepcopy(n['stage_groups'])
for x in g:
    if x['t']=='T0–T2': x['t']='T0, T1, T2'
SYS['nasopharyngeal']=auto(n,M=['M0','M1a','M1b'],groups=g)
# Thyroid (differentiated), age split
SYS['thyroid']=finish('thyroid',['T1a','T1b','T2','T3a','T3b','T4a','T4b'],['N0','N1a','N1b'],['M0','M1'],[
 ['I',['T1a','T1b','T2','T3a','T3b','T4a','T4b'],['N0','N1a','N1b'],['M0'],{'age':['<55']}],
 ['II',['T1a','T1b','T2','T3a','T3b','T4a','T4b'],['N0','N1a','N1b'],['M1'],{'age':['<55']}],
 ['I',['T1a','T1b','T2'],['N0'],['M0'],{'age':['≥55']}],
 ['II',['T1a','T1b','T2'],['N1a','N1b'],['M0'],{'age':['≥55']}],
 ['II',['T3a','T3b'],['N0','N1a','N1b'],['M0'],{'age':['≥55']}],
 ['III',['T4a'],['N0','N1a','N1b'],['M0'],{'age':['≥55']}],
 ['IVA',['T4b'],['N0','N1a','N1b'],['M0'],{'age':['≥55']}],
 ['IVB',['T1a','T1b','T2','T3a','T3b','T4a','T4b'],['N0','N1a','N1b'],['M1'],{'age':['≥55']}]],Q={'age':['<55','≥55']})
# Prostate, clinical T, PSA and Grade Group
PT=['cT1a','cT1b','cT1c','cT2a','cT2b','cT2c','cT3a','cT3b','cT4']
PSA=['<10','10–<20','≥20']; GG=['GG1','GG2','GG3','GG4','GG5']
SYS['prostate']=finish('prostate',PT,['N0','N1'],['M0','M1a','M1b','M1c'],[
 ['I',PT[:4],['N0'],['M0'],{'psa':['<10'],'gg':['GG1']}],
 ['IIA',PT[:4],['N0'],['M0'],{'psa':['10–<20'],'gg':['GG1']}],
 ['IIA',['cT2b','cT2c'],['N0'],['M0'],{'psa':['<10','10–<20'],'gg':['GG1']}],
 ['IIB',PT[:6],['N0'],['M0'],{'psa':['<10','10–<20'],'gg':['GG2']}],
 ['IIC',PT[:6],['N0'],['M0'],{'psa':['<10','10–<20'],'gg':['GG3','GG4']}],
 ['IIIA',PT[:6],['N0'],['M0'],{'psa':['≥20'],'gg':['GG1','GG2','GG3','GG4']}],
 ['IIIB',['cT3a','cT3b','cT4'],['N0'],['M0'],{'gg':['GG1','GG2','GG3','GG4']}],
 ['IIIC',PT,['N0'],['M0'],{'gg':['GG5']}],
 ['IVA',PT,['N1'],['M0']],
 ['IVB',PT,['N0','N1'],['M1a','M1b','M1c']]],Q={'psa':PSA,'gg':GG})
CI['prostate']['drill_t']=[['cT1a','Incidental histological finding in ≤5% of resected tissue'],['cT1b','Incidental histological finding in >5% of resected tissue'],['cT1c','Not palpable; found on needle biopsy for raised PSA'],['cT2a','Palpable, confined to prostate, ≤half of one lobe'],['cT2b','Palpable, confined to prostate, >half of one lobe, one lobe only'],['cT2c','Palpable, confined to prostate, both lobes'],['cT3a','Extraprostatic extension, unilateral or bilateral'],['cT3b','Invades seminal vesicle(s)'],['cT4','Fixed or invades structures other than seminal vesicles: external sphincter, rectum, bladder, levator muscles, pelvic wall']]
notes['prostate']='Clinical T only; pT2 rows of the Staging module are not drilled'
# Testis with S
TT=['pTis','pT1','pT2','pT3','pT4']; TN=['N0','N1','N2','N3']
SYS['testis']=finish('testis',TT,TN,['M0','M1a','M1b'],[
 ['0',['pTis'],['N0'],['M0'],{'s':['S0']}],['IA',['pT1'],['N0'],['M0'],{'s':['S0']}],['IB',['pT2','pT3','pT4'],['N0'],['M0'],{'s':['S0']}],
 ['IS',TT,['N0'],['M0'],{'s':['S1','S2','S3']}],
 ['IIA',TT,['N1'],['M0'],{'s':['S0','S1']}],['IIB',TT,['N2'],['M0'],{'s':['S0','S1']}],['IIC',TT,['N3'],['M0'],{'s':['S0','S1']}],
 ['IIIA',TT,TN,['M1a'],{'s':['S0','S1']}],['IIIB',TT,['N1','N2','N3'],['M0'],{'s':['S2']}],['IIIB',TT,TN,['M1a'],{'s':['S2']}],
 ['IIIC',TT,['N1','N2','N3'],['M0'],{'s':['S3']}],['IIIC',TT,TN,['M1a'],{'s':['S3']}],['IIIC',TT,TN,['M1b']]],Q={'s':['S0','S1','S2','S3']})
# Sarcomas with grade
SYS['soft-tissue-sarcoma']=finish('sts',['T1','T2','T3','T4'],['N0','N1'],['M0','M1'],[
 ['IA',['T1'],['N0'],['M0'],{'g':['G1']}],['IB',['T2','T3','T4'],['N0'],['M0'],{'g':['G1']}],['II',['T1'],['N0'],['M0'],{'g':['G2','G3']}],
 ['IIIA',['T2'],['N0'],['M0'],{'g':['G2','G3']}],['IIIB',['T3','T4'],['N0'],['M0'],{'g':['G2','G3']}],['IV',['T1','T2','T3','T4'],['N1'],['M0']],['IV',['T1','T2','T3','T4'],['N0','N1'],['M1']]],Q={'g':['G1','G2','G3']})
SYS['bone-sarcoma']=finish('bone',['T1','T2','T3'],['N0','N1'],['M0','M1a','M1b'],[
 ['IA',['T1'],['N0'],['M0'],{'g':['G1']}],['IB',['T2','T3'],['N0'],['M0'],{'g':['G1']}],['IIA',['T1'],['N0'],['M0'],{'g':['G2','G3']}],
 ['IIB',['T2'],['N0'],['M0'],{'g':['G2','G3']}],['III',['T3'],['N0'],['M0'],{'g':['G2','G3']}],['IVA',['T1','T2','T3'],['N0'],['M1a']],
 ['IVB',['T1','T2','T3'],['N1'],['M0','M1a','M1b']],['IVB',['T1','T2','T3'],['N0'],['M1b']]],Q={'g':['G1','G2','G3']})
# Appendix (v9) with histotype and grade for M1b
a=CI['appendix']; AT=['Tis','T1','T2','T3','T4a','T4b']; AN=['N0','N1','N2']
base=[[g['stage']]+[expand(g['t'],AT)[0],expand(g['n'],AN)[0],['M0']] for g in a['stage_groups'] if g['m']=='M0']
SYS['appendix']=finish('appendix',AT,AN,['M0','M1a','M1b','M1c'],base+[
 ['IVA',AT,AN,['M1a']],['IVA',AT,AN,['M1b'],{'hist':['Mucinous'],'g':['G1']}],['IVB',AT,AN,['M1b'],{'hist':['Non-mucinous'],'g':['G1']}],
 ['IVB',AT,AN,['M1b'],{'g':['G2','G3']}],['IVC',AT,AN,['M1c']]],Q={'hist':['Mucinous','Non-mucinous'],'g':['G1','G2','G3']})
# Staging block for each hand system's grouping; Table in a case opens that block
ANCHORS={'esophageal':{'eso-c-scc':'groups-c-scc','eso-c-ac':'groups-c-ac','eso-p-scc':'groups-p','eso-p-ac':'groups-p','eso-yp':'groups-yp'}}
for sid,amap in ANCHORS.items():
    have={CI[sid].get('stage_groups_id')}|{g['id'] for g in CI[sid].get('stage_groups_more') or []}
    assert set(amap.values())<=have,(sid,set(amap.values())-have)
# ---- output ----
out=[]
for c in C:
    sid=c['id']
    raw={k:c.get(k) for k in ('t','n','pn','m','stage_groups','stage_groups_title','stage_groups_q_title','n_title','pn_title','t_title','stages_other','stages_other_title','figo','matrix_tables','drill_t','stage_groups_more') if c.get(k)}
    site=dict(id=sid,label=c['name'],section=SEC[c['section']],type=c['type'],system=c['system_label'],edition=c['edition'],source=c['source'],source_url=c['source_url'],notes=c.get('notes',''),raw=raw)
    if sid in HAND: site['hand']=HAND[sid]
    if sid in ANCHORS: site['anchors']=ANCHORS[sid]
    if sid in SYS: s=SYS[sid]; s['id']=sid; s['label']=c['name']; s['edition']=c['system_label']; site['auto']=s
    if sid in notes: site['drill_note']=notes[sid]
    out.append(site)
open(OUT,'w',encoding='utf-8').write('window.DRILL_SITES='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(out),'sites;',len(SYS),'auto systems;', sum(1 for s in out if 'hand' in s),'hand')
for s in out:
    if 'auto' not in s and 'hand' not in s: print('no system:',s['id'],s['type'])
