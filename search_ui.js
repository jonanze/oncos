import searchCore from './search_runtime.js';

const MODULES = ['evidence', 'staging', 'drugs', 'tox', 'acute'];
const LABELS = {
  evidence: 'Evidence', staging: 'Staging',
  drugs: 'Drugs', tox: 'Tox', acute: 'Acute'
};

const dialog = document.getElementById('global-search-dialog');
const dialogQuery = document.getElementById('global-search-query');
const results = document.getElementById('global-search-results');
const closeButton = document.getElementById('global-search-close');
const directButton = document.getElementById('global-search-open');
const resultStatus = document.getElementById('global-search-status');
let bootstrapState = 'loading';
const DISPLAY_LIMIT = 120;
let shownLimit = DISPLAY_LIMIT;

let records = [];
let ready = false;
let returnFocus = null;
let store = searchCore.createStore(window.indexedDB);
let inertState = [];

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

// Evidence search entries are made from the one Evidence data file the view and
// the maps read (site review B2), with the fields the generator's search_records()
// used for search/evidence.json.
function evidenceRecords(data) {
  const text = value => String(value == null ? '' : value);
  return data.trials.map(trial => ({
    module: 'evidence', id: text(trial.anchor).trim(), kind: 'trial',
    title: text(trial.study).trim(),
    subtitle: [trial.sheet, trial.subcat, trial.type, trial.year].map(v => text(v || '')).filter(Boolean).join(' · ').trim(),
    body: ['population', 'arms', 'endpoint', 'findings'].map(k => text(trial[k] || '')).join(' ').trim(),
    keywords: (trial.refs || []).map(ref => ['text', 'descriptor', 'pmid'].map(k => text(ref[k] == null ? '' : ref[k])).join(' ')).join(' ').trim(),
  }));
}

function loadJSON(url) {
  if (window.oncosLoad) return window.oncosLoad(url);
  return fetch(url, {credentials: 'same-origin'}).then(r => {
    if (!r.ok) throw new Error(`${url} returned ${r.status}`);
    return r.json();
  });
}

// Only catalogues whose hash changed since the stored snapshot are downloaded (B6).
async function fetchSnapshot(manifest, previous) {
  const found = [];
  const before = previous && previous.manifest && previous.manifest.modules || {};
  for (const module of MODULES) {
    const descriptor = manifest.modules && manifest.modules[module];
    if (!descriptor) throw new Error(`search manifest missing ${module}`);
    if (before[module] && before[module].sha256 === descriptor.sha256 && before[module].url === descriptor.url) {
      const same = previous.records.filter(record => record.module === module);
      if (same.length === descriptor.records) { found.push(...same); continue; }
    }
    if (descriptor.derive === 'evidence') {
      const records = evidenceRecords(await loadJSON(descriptor.url));
      if (records.length !== descriptor.records) throw new Error('invalid search payload: evidence');
      found.push(...records);
      continue;
    }
    const response = await fetch(descriptor.url, {credentials: 'same-origin'});
    if (!response.ok) throw new Error(`search ${module} returned ${response.status}`);
    const text = await response.text();
    if (await sha256(text) !== descriptor.sha256) {
      throw new Error(`search checksum mismatch: ${module}`);
    }
    const payload = JSON.parse(text);
    if (payload.schema !== searchCore.SCHEMA_VERSION || payload.module !== module ||
        !Array.isArray(payload.records) || payload.records.length !== descriptor.records) {
      throw new Error(`invalid search payload: ${module}`);
    }
    found.push(...payload.records);
  }
  return found;
}

async function bootstrap() {
  let active = null;
  try {
    active = await store.loadActive();
  } catch (_) {
    store = searchCore.createStore(null);
  }
  try {
    const response = await fetch('/search/manifest.json', {
      credentials: 'same-origin', cache: 'no-cache'
    });
    if (!response.ok) throw new Error(`search manifest returned ${response.status}`);
    const manifest = await response.json();
    if (active && active.manifest && active.manifest.build === manifest.build) {
      records = active.records;
    } else {
      const next = await fetchSnapshot(manifest, active);
      try {
        await store.installSnapshot(manifest, next);
      } catch (_) {
        store = searchCore.createStore(null);
        await store.installSnapshot(manifest, next);
      }
      records = next;
    }
  } catch (error) {
    console.warn('oncOS search refresh failed:', error.message);
    if (!active) {
      try { active = await store.loadActive(); } catch (_) { active = null; }
    }
    records = active ? active.records : [];
    bootstrapState = active ? 'saved' : 'unavailable';
  }
  const sourceState = bootstrapState;
  bootstrapState = 'loading';
  // Prepared in idle time unless the panel is open and waiting (B4).
  await searchCore.prime(records, () => document.hidden ? Promise.resolve() :
    new Promise(resolve => !dialog.hidden || !window.requestIdleCallback ? setTimeout(resolve, 0) :
      window.requestIdleCallback(() => resolve(), {timeout: 500})), dialog.hidden ? 20 : 80);
  ready = records.length > 0;
  bootstrapState = ready ? (sourceState === 'saved' ? 'saved' : 'ready') : 'unavailable';
  if (!dialog.hidden) render(dialogQuery.value);
  document.dispatchEvent(new CustomEvent('oncos:search-ready', {
    detail: {ready, records: records.length}
  }));
}

function snippet(record, query) {
  let text = String(record.body || record.keywords || record.subtitle || '').replace(/\s+/g, ' ').trim();
  if(record.module==='tox'&&record.kind==='irAE'){
    // The derived catalogue prefixes clinical sections with relationship IDs
    // and Boolean flags. Display from the first section used by the irAE page.
    const clinicalStart=text.indexOf('Exclude ');
    if(clinicalStart>0)text=text.slice(clinicalStart);
  }
  if (!text) return '';
  // Keep offsets in the original text: spelling/alias normalization changes
  // string lengths and must never be used as an index into the display text.
  const terms = searchCore.displayTerms(query);
  let at = -1;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`\\b${escaped}${term.length <= 3 ? '\\b' : ''}`, 'i').exec(text);
    if (match) { at = match.index; break; }
  }
  let start = Math.max(0, at < 0 ? 0 : at - 70);
  if (start) start = text.lastIndexOf(' ', start) + 1;
  let end = Math.min(text.length, start + 210);
  if (end < text.length) {
    const boundary = text.lastIndexOf(' ', end);
    if (boundary > start) end = boundary;
  }
  return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function resultLabel(record) {
  if (record.module !== 'tox') return LABELS[record.module];
  return {CTCAE:'Tox · CTCAE grading', irAE:'Tox · irAE management', Supportive:'Tox · Supportive care'}[record.kind] || LABELS.tox;
}

function resultSubtitle(record) {
  if (record.module !== 'tox') return record.subtitle;
  return String(record.subtitle || '').replace(/^(CTCAE grading|irAE management|Supportive care)(?: · |$)/i, '');
}

function isExactName(record, query) {
  const clean = value => searchCore.normalize(value).replace(/\s/g, '');
  const value = clean(query);
  return value && (clean(record.title) === value || clean(record.id) === value ||
    (record.kind === 'drug' && clean(record.keywords) === value));
}

function appendText(parent, className, text) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function render(query) {
  if (!dialog.hidden) start();
  const hits = ready ? searchCore.search(records, query, {limit: Infinity}) : [];
  results.replaceChildren();
  resultStatus.textContent = query.trim() && ready && hits.length
    ? `${hits.length > shownLimit ? `Showing ${shownLimit} of ${hits.length}` : hits.length} result${hits.length === 1 ? '' : 's'}` : '';
  let message = '';
  if (bootstrapState === 'loading') message = 'Preparing search…';
  else if (!ready) message = 'Search unavailable';
  else if (!hits.length) message = 'No matches';
  if (message) {
    const empty = document.createElement('p');
    empty.className = 'gs-empty';
    if (bootstrapState === 'loading') {
      // The oncOS cell (cell-loader.js animates it) while the index prepares.
      const wait = document.createElement('span'); wait.className = 'cell-wait'; wait.setAttribute('role', 'status');
      const mark = document.createElement('span'); mark.className = 'cell-loader'; mark.setAttribute('aria-hidden', 'true');
      mark.appendChild(document.createElement('canvas'));
      appendText(wait, 'cell-wait-label', message); wait.prepend(mark); empty.appendChild(wait);
    } else empty.textContent = message;
    results.appendChild(empty);
    if (ready && query.trim() && !hits.length) {
      for (const suggestion of searchCore.suggest(records, query)) {
        const choice = document.createElement('button'); choice.type = 'button';
        choice.className = 'gs-retry'; choice.textContent = `Search for “${suggestion.title}”`;
        choice.onclick = () => {
          dialogQuery.value = suggestion.title; shownLimit = DISPLAY_LIMIT;
          render(dialogQuery.value); updateSearchURL(); dialogQuery.focus();
        };
        results.appendChild(choice);
      }
    }
    if (!ready && bootstrapState !== 'loading') {
      const retry = document.createElement('button'); retry.type = 'button';
      retry.className = 'gs-retry'; retry.textContent = 'Try again';
      retry.onclick = () => { bootstrapState = 'loading'; started = null; render(query); };
      results.appendChild(retry);
    }
    return;
  }
  for (const record of hits.slice(0, shownLimit)) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `gs-result m-${record.module}`;
    button.dataset.module = record.module;
    button.dataset.recordId = record.id;
    appendText(button, 'gs-module', resultLabel(record));
    appendText(button, 'gs-title', record.title);
    const subtitle = resultSubtitle(record);
    if (subtitle) appendText(button, 'gs-subtitle', subtitle);
    const preview = isExactName(record, query) ? '' : snippet(record, query);
    if (preview) appendText(button, 'gs-preview', preview);
    button.addEventListener('click', () => {
      hideDialog();
      document.dispatchEvent(new CustomEvent('oncos:open-search-result', {detail: record}));
    });
    results.appendChild(button);
  }
  if (hits.length > shownLimit) {
    const more = document.createElement('button'); more.type = 'button';
    more.className = 'gs-retry'; more.textContent = 'Show more results';
    more.onclick = () => {
      const next = shownLimit, scroll = results.scrollTop;
      shownLimit += DISPLAY_LIMIT; render(query); results.scrollTop = scroll;
      const firstNew = results.querySelectorAll('.gs-result')[next];
      if (firstNew) firstNew.focus({preventScroll:true});
    };
    results.appendChild(more);
  }
}

function updateSearchURL() {
  const url = new URL(location.href);
  url.searchParams.set('search', dialogQuery.value.trim());
  url.searchParams.delete('searchModule');
  history.replaceState({...history.state, oncosSearch: dialogQuery.value.trim()}, '', url);
}

function setBackgroundInert(on) {
  if (on && inertState.length) return; // An already-open search must retain its original background state.
  const nodes = document.querySelectorAll('.oncos-rail,#viewroot');
  if (on) {
    inertState = Array.from(nodes, node => ({node, inert: node.inert}));
    inertState.forEach(({node}) => { node.inert = true; });
  } else {
    inertState.forEach(({node, inert}) => { node.inert = inert; });
    inertState = [];
  }
}

function showDialog(query, pushHistory) {
  document.dispatchEvent(new Event('oncos:close-navigation'));
  const existingURL = new URL(location.href);
  const alreadyInSearch = existingURL.searchParams.has('search');
  const clean = (pushHistory && alreadyInSearch ? existingURL.searchParams.get('search') : query).trim();
  if (dialog.hidden) returnFocus = document.activeElement;
  shownLimit = DISPLAY_LIMIT;
  if (pushHistory) {
    const url = new URL(location.href);
    url.searchParams.set('search', clean);
    url.searchParams.delete('searchModule');
    const nextState = {...history.state, oncosSearch: clean};
    if (alreadyInSearch) history.replaceState(nextState, '', url);
    else history.pushState({...nextState, oncosSearchEntry: true}, '', url);
  }
  dialog.hidden = false;
  document.body.classList.add('global-search-open');
  setBackgroundInert(true);
  dialogQuery.value = clean;
  render(clean);
  setTimeout(() => dialogQuery.focus(), 0);
}

function hideDialog() {
  if (dialog.hidden) return;
  dialog.hidden = true;
  document.body.classList.remove('global-search-open');
  setBackgroundInert(false);
  if (returnFocus && returnFocus.isConnected && returnFocus.getBoundingClientRect().width &&
      returnFocus.matches('a[href],button,input,select,textarea,summary,[tabindex]') &&
      !returnFocus.disabled && !returnFocus.closest('[inert]')) returnFocus.focus({preventScroll:true});
  else if (directButton.offsetParent !== null) directButton.focus({preventScroll:true});
}

function closeFromUser() {
  const url = new URL(location.href);
  if (url.searchParams.has('search') && history.state && history.state.oncosSearchEntry) history.back();
  else {
    url.searchParams.delete('search'); url.searchParams.delete('searchModule');
    history.replaceState(history.state, '', url); hideDialog();
  }
}

closeButton.addEventListener('click', closeFromUser);
dialogQuery.addEventListener('input', () => {
  shownLimit = DISPLAY_LIMIT;
  render(dialogQuery.value); results.scrollTop = 0; updateSearchURL();
});
directButton.addEventListener('click', () => {
  showDialog(dialogQuery.value, true);
});
document.addEventListener('keydown', event => {
  const target = event.target;
  const editing = target && (target.matches('input,textarea,select') || target.isContentEditable);
  const shortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k';
  const slash = event.key === '/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (shortcut || slash) {
    event.preventDefault();
    if (dialog.hidden) directButton.click(); else dialogQuery.focus();
  }
}, true);

dialog.addEventListener('keydown', event => {
  if (event.isComposing || event.keyCode === 229) return;
  const entries = Array.from(results.querySelectorAll('.gs-result'));
  const onQuery = event.target === dialogQuery;
  const index = entries.indexOf(document.activeElement);
  if ((onQuery || index >= 0) && entries.length && ['ArrowDown','ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const next = onQuery ? (event.key==='ArrowDown' ? 0 : entries.length-1)
      : (index + (event.key==='ArrowDown'?1:-1) + entries.length) % entries.length;
    entries[next].focus(); entries[next].scrollIntoView({block:'nearest'}); return;
  }
  if (event.key === 'Escape') {
    event.preventDefault(); closeFromUser(); return;
  }
  // Enter (a phone keyboard's Go/Search) in the query opens the top result; on a
  // focused result the button's own Enter opens that one.
  if (event.key === 'Enter' && onQuery && entries.length) {
    event.preventDefault(); entries[0].click(); return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(dialog.querySelectorAll('button,input,[href],[tabindex]:not([tabindex="-1"])'))
    .filter(node => !node.disabled && node.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});

window.addEventListener('popstate', () => {
  const url = new URL(location.href);
  if (url.searchParams.has('search')) showDialog(url.searchParams.get('search'), false);
  else hideDialog();
});

// Search is prepared when the browser is idle after load, or at once when the
// panel opens or the address carries a search (site review B4).
let started = null;
function start() {
  if (!started) started = bootstrap();
  return started;
}
if (new URL(location.href).searchParams.has('search')) {
  start().then(() => showDialog(new URL(location.href).searchParams.get('search'), false));
} else {
  const idle = () => window.requestIdleCallback ? window.requestIdleCallback(() => start(), {timeout: 10000}) : setTimeout(start, 4000);
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, {once: true});
}
