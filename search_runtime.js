const SCHEMA_VERSION = 1;


function normalize(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}


function scoreRecord(record, queryPhrase, terms) {
  const title = normalize(record.title);
  const keywords = normalize(record.keywords);
  const subtitle = normalize(record.subtitle);
  const body = normalize(record.body);
  const hay = `${title} ${keywords} ${subtitle} ${body}`;
  if (!terms.every(term => hay.includes(term))) return 0;

  let score = 1;
  if (title === queryPhrase) score += 1200;
  else if (title.startsWith(queryPhrase)) score += 700;
  else if (title.includes(queryPhrase)) score += 450;
  if (keywords.includes(queryPhrase)) score += 260;
  if (subtitle.includes(queryPhrase)) score += 180;
  if (body.includes(queryPhrase)) score += 80;
  for (const term of terms) {
    if (title.includes(term)) score += 80;
    if (keywords.includes(term)) score += 45;
    if (subtitle.includes(term)) score += 25;
    if (body.includes(term)) score += 8;
  }
  return score;
}


function search(records, query, {limit = 100} = {}) {
  const phrase = normalize(query);
  if (!phrase) return [];
  const terms = phrase.split(' ');
  return records
    .map(record => ({record, score: scoreRecord(record, phrase, terms)}))
    .filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score ||
      a.record.title.localeCompare(b.record.title) ||
      a.record.module.localeCompare(b.record.module))
    .slice(0, limit)
    .map(hit => ({...hit.record, score: hit.score}));
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


export default {SCHEMA_VERSION, normalize, search, createStore};
