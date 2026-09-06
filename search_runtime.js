const SCHEMA_VERSION = 1;


// Text equivalences only. Display strings and clinical records are untouched.
// T-DXd/T-DM1 expansions are explicit in the filed DESTINY-Breast05 arm label.
const WORD_FORMS = {
  tumour:'tumor', tumours:'tumors', neutropaenia:'neutropenia',
  diarrhoea:'diarrhea', anaemia:'anemia', oedema:'edema',
  oesophageal:'esophageal', haematological:'hematological',
};
const WORD_VARIANTS = new RegExp(`\\b(?:${Object.keys(WORD_FORMS).join('|')})\\b`, 'g');
const preparedRecords = new WeakMap();
const SIGNED_MARKER = /\b(?:her2|hr|er|pr|pdl1)(?:positive|negative)\b/;

function markerKey(marker, status) {
  const key = marker.replace(/[- ]/g, '');
  return `${key} ${key}${status} `;
}

function normalize(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2212\u2010-\u2014]/g, '-')
    .replace(/\bt[\s-]?dxd\b/gi, 'trastuzumab deruxtecan')
    .replace(/\bt[\s-]?dm1\b/gi, 'trastuzumab emtansine')
    .replace(/\b(her2|hr|er|pr|pd[- ]?l1)[\s-]*(positive|negative)\b/gi,
      (_, marker, status) => markerKey(marker, status))
    .replace(/\b(her2|hr|er|pr|pd[- ]?l1)\s*[(\[]\s*([+-])\s*[)\]]/gi,
      (_, marker, sign) => markerKey(marker, sign === '+' ? 'positive' : 'negative'))
    .replace(/\b(her2|hr|er|pr|pd[- ]?l1)\s*([+-])(?=$|[^a-zA-Z0-9]|(?:her2|hr|er|pr|pd[- ]?l1)\b)/gi,
      (_, marker, sign) => markerKey(marker, sign === '+' ? 'positive' : 'negative'))
    .replace(/\bpd[- ]?l1\b/gi, 'pdl1')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(WORD_VARIANTS, word => WORD_FORMS[word])
    .trim()
    .replace(/\s+/g, ' ');
}

function displayTerms(query) {
  const normalized = normalize(query);
  const terms = new Set([...(String(query).match(/[\p{L}\p{N}+-]+/gu) || []), normalized, ...normalized.split(' ')]);
  for (const [variant, canonical] of Object.entries(WORD_FORMS)) {
    if (terms.has(canonical)) terms.add(variant);
  }
  if (terms.has('pdl1')) { terms.add('PD-L1'); terms.add('PD L1'); }
  if (normalized.includes('trastuzumab deruxtecan')) terms.add('T-DXd');
  if (normalized.includes('trastuzumab emtansine')) terms.add('T-DM1');
  for (const term of [...terms]) {
    const marker = term.match(/^(her2|hr|er|pr|pdl1)(positive|negative)$/);
    if (!marker) continue;
    const name = marker[1] === 'pdl1' ? 'PD-L1' : marker[1];
    terms.add(`${name}-${marker[2]}`); terms.add(`${name} ${marker[2]}`);
    terms.add(name + (marker[2] === 'positive' ? '+' : '-'));
    terms.add(`${name} (${marker[2] === 'positive' ? '+' : '-'})`);
    terms.add(`${name}(${marker[2] === 'positive' ? '+' : '-'})`);
    if (marker[2] === 'negative') terms.add(name + '−');
  }
  return [...terms].filter(Boolean).sort((a,b) => b.length-a.length);
}

function prepare(record) {
  const fields = [record.title, record.keywords, record.subtitle, record.body, record.id];
  const previous = preparedRecords.get(record);
  if (previous && fields.every((value, i) => previous.fields[i] === value)) return previous;
  const [title, keywords, subtitle, body, id] = fields.map(normalize);
  const lead = normalize(String(record.body || '').split(/[.!?](?:\s|$)/)[0].slice(0, 360));
  const prepared = {fields, title, keywords, subtitle, body, id, lead,
    hay: `${title} ${keywords} ${subtitle} ${body} ${id}`};
  preparedRecords.set(record, prepared);
  return prepared;
}

function queryTerm(text) {
  const whole = new RegExp(`\\b${text}\\b`);
  return {text, whole, word: /^[a-z]{1,3}$/.test(text) ? whole : null};
}
function contains(text, term) {
  return term.word ? term.word.test(text) : text.includes(term.text);
}

async function prime(records, yieldTurn = () => Promise.resolve()) {
  for (let offset = 0; offset < records.length; offset += 80) {
    for (const record of records.slice(offset, offset + 80)) {
      if (record && typeof record.title === 'string' && typeof record.module === 'string') prepare(record);
    }
    if (offset + 80 < records.length) await yieldTurn();
  }
}

function scoreRecord(record, phrase, phraseTerm, terms) {
  const p = prepare(record);
  if (!terms.every(term => contains(p.hay, term))) return 0;
  let score = 1;
  if (p.title === phrase) score += 1200;
  else if (p.title.startsWith(phrase) && contains(p.title, phraseTerm)) score += 700;
  else if (contains(p.title, phraseTerm)) score += 450;
  if (p.id === phrase) score += 1100;
  if (contains(p.keywords, phraseTerm)) score += 260;
  if (contains(p.subtitle, phraseTerm)) score += 180;
  if (contains(p.body, phraseTerm)) score += 80;
  for (const term of terms) {
    if (contains(p.title, term)) score += 80;
    if (contains(p.keywords, term)) score += 45;
    if (contains(p.subtitle, term)) score += 25;
    if (contains(p.body, term)) score += 8;
  }
  // Emergency records start with a topic description. Matching that complete
  // description is more useful than an incidental phrase in a trial's AE list.
  if (record.kind === 'emergency' && terms.every(term => term.whole.test(`${p.title} ${p.lead}`))) score += 350;
  if (record.kind === 'section' && p.title === 'references' && p.title !== phrase) return 0.5;
  return score;
}

function search(records, query, {limit = 100, module = 'all'} = {}) {
  const phrase = normalize(query);
  if (!phrase) return [];
  const terms = phrase.split(' ').map(queryTerm);
  const phraseTerm = queryTerm(phrase);
  return records
    .filter(record => record && typeof record.title === 'string' && typeof record.module === 'string' &&
      (module === 'all' || record.module === module))
    .map(record => ({record, score: scoreRecord(record, phrase, phraseTerm, terms)}))
    .filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score ||
      a.record.title.localeCompare(b.record.title) ||
      a.record.module.localeCompare(b.record.module))
    .slice(0, limit)
    .map(hit => ({...hit.record, score: hit.score}));
}

// Restricted to plausible name typos; short clinical acronyms and biomarker
// signs are never corrected. Callers must present suggestions for an explicit tap.
function editDistance(a, b) {
  const rows = Array.from({length:a.length+1}, () => Array(b.length+1).fill(0));
  for (let i=0;i<=a.length;i++) rows[i][0]=i;
  for (let j=0;j<=b.length;j++) rows[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) {
    rows[i][j]=Math.min(rows[i-1][j]+1, rows[i][j-1]+1, rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}

function suggest(records, query, {limit = 4, module = 'all'} = {}) {
  const phrase = normalize(query);
  if (!/^[a-z ]{5,64}$/.test(phrase) || /[+\-\u2212\u2010-\u2014]/.test(query) || SIGNED_MARKER.test(phrase)) return [];
  const maxDistance = phrase.length >= 9 ? 2 : 1;
  const matches=[];
  for(const record of records) {
    if(!record || typeof record.title !== 'string' || typeof record.module !== 'string' ||
      (module !== 'all' && record.module !== module)) continue;
    const title=prepare(record).title;
    if (SIGNED_MARKER.test(title)) continue;
    if(Math.abs(title.length-phrase.length)>maxDistance) continue;
    const distance=editDistance(phrase,title);
    if(distance>0&&distance<=maxDistance) matches.push({title:record.title, distance});
  }
  matches.sort((a,b)=>a.distance-b.distance||a.title.localeCompare(b.title));
  const seen=new Set();
  return matches.filter(match=>!seen.has(match.title)&&seen.add(match.title)).slice(0,limit);
}


function validateSnapshot(manifest, records) {
  if (!manifest || manifest.schema !== SCHEMA_VERSION) {
    throw new Error('unsupported search schema');
  }
  if (!manifest.build) throw new Error('search build id is required');
  if (!Array.isArray(records)) throw new Error('search records must be an array');
}


function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}


function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}


function createStore(indexedDB) {
  if (!indexedDB) {
    let active = null;
    return {
      async installSnapshot(manifest, records) {
        validateSnapshot(manifest, records);
        active = {manifest: structuredClone(manifest), records: structuredClone(records)};
      },
      async loadActive() {
        return active ? structuredClone(active) : null;
      },
    };
  }

  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('oncos-search', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', {keyPath: 'build'});
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', {keyPath: 'key'});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
    });
    return dbPromise;
  }

  return {
    async installSnapshot(manifest, records) {
      validateSnapshot(manifest, records);
      const db = await open();
      const tx = db.transaction(['snapshots', 'meta'], 'readwrite');
      tx.objectStore('snapshots').put({
        build: manifest.build,
        manifest: structuredClone(manifest),
        records: structuredClone(records),
      });
      tx.objectStore('meta').put({key: 'active', build: manifest.build});
      await transactionDone(tx);
    },
    async loadActive() {
      const db = await open();
      const metaTx = db.transaction('meta', 'readonly');
      const active = await requestResult(metaTx.objectStore('meta').get('active'));
      if (!active) return null;
      const snapshotTx = db.transaction('snapshots', 'readonly');
      const snapshot = await requestResult(
        snapshotTx.objectStore('snapshots').get(active.build)
      );
      if (!snapshot) return null;
      return {manifest: snapshot.manifest, records: snapshot.records};
    },
  };
}


export default {SCHEMA_VERSION, normalize, displayTerms, search, suggest, prime, createStore};
