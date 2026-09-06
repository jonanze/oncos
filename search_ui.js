import searchCore from './search_runtime.js';

const MODULES = ['notes', 'evidence', 'staging', 'drugs', 'tox', 'acute'];
const LABELS = {
  notes: 'Notes', evidence: 'Evidence', staging: 'Staging',
  drugs: 'Drugs', tox: 'Tox', acute: 'Acute'
};

const dialog = document.getElementById('global-search-dialog');
const dialogQuery = document.getElementById('global-search-query');
const results = document.getElementById('global-search-results');
const closeButton = document.getElementById('global-search-close');
const directButton = document.getElementById('global-search-open');
const filters = document.getElementById('global-search-filters');
const resultStatus = document.getElementById('global-search-status');
const moduleButtons = new Map();
let selectedModule = 'all';
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

async function fetchSnapshot(manifest) {
  const found = [];
  for (const module of MODULES) {
    const descriptor = manifest.modules && manifest.modules[module];
    if (!descriptor) throw new Error(`search manifest missing ${module}`);
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
      const next = await fetchSnapshot(manifest);
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
  await searchCore.prime(records, () => document.hidden ? Promise.resolve() :
    new Promise(resolve => setTimeout(resolve, 0)));
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
  const allHits = ready ? searchCore.search(records, query, {limit: Infinity}) : [];
  const hits = selectedModule === 'all' ? allHits : allHits.filter(hit => hit.module === selectedModule);
  for (const [module, button] of moduleButtons) {
    const count = module === 'all' ? allHits.length : allHits.filter(hit => hit.module === module).length;
    button.textContent = `${module === 'all' ? 'All' : LABELS[module]}${query.trim() && ready ? ` (${count})` : ''}`;
    button.setAttribute('aria-pressed', String(selectedModule === module));
  }
  results.replaceChildren();
  resultStatus.textContent = query.trim() && ready
    ? `${hits.length > shownLimit ? `Showing ${shownLimit} of ${hits.length}` : hits.length} result${hits.length === 1 ? '' : 's'}${bootstrapState === 'saved' ? ' · Using saved search index' : ''}` : '';
  let message = '';
  if (bootstrapState === 'loading') message = 'Preparing search…';
  else if (!ready) message = 'Search is unavailable. Reconnect and try again.';
  else if (!query.trim()) message = 'Find a trial, drug, cancer or clinical topic.';
  else if (!hits.length) message = selectedModule === 'all'
    ? 'No matches. Try a shorter name or a different keyword.'
    : `No matches in ${LABELS[selectedModule]}. Try all oncOS.`;
  if (message) {
    const empty = document.createElement('p');
    empty.className = 'gs-empty'; empty.textContent = message;
    results.appendChild(empty);
    if (ready && query.trim() && !hits.length) {
      for (const suggestion of searchCore.suggest(records, query, {module:selectedModule})) {
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
      retry.onclick = () => { bootstrapState = 'loading'; render(query); bootstrap(); };
      results.appendChild(retry);
    } else if (query.trim() && !hits.length && selectedModule !== 'all') {
      const broaden = document.createElement('button'); broaden.type = 'button';
      broaden.className = 'gs-retry'; broaden.textContent = 'Search all oncOS';
      broaden.onclick = () => { setModule('all'); dialogQuery.focus(); };
      results.appendChild(broaden);
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

function readModule(url) {
  const value = url.searchParams.get('searchModule');
  return MODULES.includes(value) ? value : 'all';
}

function updateSearchURL() {
  const url = new URL(location.href);
  url.searchParams.set('search', dialogQuery.value.trim());
  if (selectedModule === 'all') url.searchParams.delete('searchModule');
  else url.searchParams.set('searchModule', selectedModule);
  history.replaceState({...history.state, oncosSearch: dialogQuery.value.trim()}, '', url);
}

function setModule(module) {
  selectedModule = module; shownLimit = DISPLAY_LIMIT;
  render(dialogQuery.value); results.scrollTop = 0;
  updateSearchURL();
}

for (const module of ['all', ...MODULES]) {
  const button = document.createElement('button'); button.type = 'button';
  button.className = 'gs-filter'; button.onclick = () => setModule(module);
  moduleButtons.set(module, button); filters.appendChild(button);
}

function setBackgroundInert(on) {
  if (on && inertState.length) return; // An already-open search must retain its original background state.
  const nodes = document.querySelectorAll('.mhead,.suite-drop,#sidebar,#backdrop,#viewroot');
  if (on) {
    inertState = Array.from(nodes, node => ({node, inert: node.inert}));
    inertState.forEach(({node}) => { node.inert = true; });
  } else {
    inertState.forEach(({node, inert}) => { node.inert = inert; });
    inertState = [];
  }
}

function showDialog(query, pushHistory) {
  const existingURL = new URL(location.href);
  const alreadyInSearch = existingURL.searchParams.has('search');
  const clean = (pushHistory && alreadyInSearch ? existingURL.searchParams.get('search') : query).trim();
  if (dialog.hidden) returnFocus = document.activeElement;
  selectedModule = pushHistory ? 'all' : readModule(new URL(location.href));
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
  if (event.key === 'Escape') {
    event.preventDefault(); closeFromUser(); return;
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

bootstrap().then(() => {
  const url = new URL(location.href);
  if (url.searchParams.has('search')) showDialog(url.searchParams.get('search'), false);
});
