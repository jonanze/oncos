import searchCore from './search_runtime.js';

const MODULES = ['notes', 'evidence', 'staging', 'drugs', 'tox', 'acute'];
const LABELS = {
  notes: 'Notes', evidence: 'Evidence', staging: 'Staging',
  drugs: 'Drugs', tox: 'Tox', acute: 'Acute'
};

const suggest = document.getElementById('global-search-suggest');
const suggestButton = document.getElementById('global-search-button');
const suggestQuery = document.getElementById('global-search-suggest-query');
const dialog = document.getElementById('global-search-dialog');
const dialogQuery = document.getElementById('global-search-query');
const results = document.getElementById('global-search-results');
const closeButton = document.getElementById('global-search-close');

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
  } catch (_) {
    if (!active) {
      try { active = await store.loadActive(); } catch (_) { active = null; }
    }
    records = active ? active.records : [];
  }
  ready = records.length > 0;
  document.dispatchEvent(new CustomEvent('oncos:search-ready', {
    detail: {ready, records: records.length}
  }));
}

function hideSuggest() {
  suggest.hidden = true;
}

function showSuggest(query) {
  if (!ready || query.trim().length < 2 || !dialog.hidden) {
    hideSuggest();
    return;
  }
  suggestQuery.textContent = query.trim();
  suggest.hidden = false;
}

function snippet(record, query) {
  const text = String(record.body || record.keywords || record.subtitle || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const term = searchCore.normalize(query).split(' ')[0];
  const normalized = searchCore.normalize(text);
  const at = term ? normalized.indexOf(term) : -1;
  const start = Math.max(0, at < 0 ? 0 : at - 70);
  const piece = text.slice(start, start + 190).trim();
  return `${start ? '…' : ''}${piece}${start + 190 < text.length ? '…' : ''}`;
}

function appendText(parent, className, text) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function render(query) {
  const hits = searchCore.search(records, query, {limit: 120});
  results.replaceChildren();
  if (!hits.length) {
    const empty = document.createElement('p');
    empty.className = 'gs-empty';
    empty.textContent = 'No oncOS result matches that search.';
    results.appendChild(empty);
    return;
  }
  for (const module of MODULES) {
    const moduleHits = hits.filter(hit => hit.module === module);
    if (!moduleHits.length) continue;
    const section = document.createElement('section');
    section.className = `gs-group m-${module}`;
    const heading = document.createElement('h3');
    heading.textContent = LABELS[module];
    section.appendChild(heading);
    for (const record of moduleHits) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gs-result';
      appendText(button, 'gs-title', record.title);
      if (record.subtitle) appendText(button, 'gs-subtitle', record.subtitle);
      const preview = snippet(record, query);
      if (preview) appendText(button, 'gs-preview', preview);
      button.addEventListener('click', () => {
        hideDialog();
        document.dispatchEvent(new CustomEvent('oncos:open-search-result', {
          detail: record
        }));
      });
      section.appendChild(button);
    }
    results.appendChild(section);
  }
}

function setBackgroundInert(on) {
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
  const clean = query.trim();
  if (!clean || !ready) return;
  returnFocus = document.activeElement;
  hideSuggest();
  dialog.hidden = false;
  document.body.classList.add('global-search-open');
  setBackgroundInert(true);
  dialogQuery.value = clean;
  render(clean);
  if (pushHistory) {
    const url = new URL(location.href);
    url.searchParams.set('search', clean);
    url.hash = '';
    history.pushState({...history.state, oncosSearch: clean}, '', url);
  }
  setTimeout(() => dialogQuery.focus(), 0);
}

function hideDialog() {
  if (dialog.hidden) return;
  dialog.hidden = true;
  document.body.classList.remove('global-search-open');
  setBackgroundInert(false);
  if (returnFocus && returnFocus.isConnected) returnFocus.focus();
}

function closeFromUser() {
  const url = new URL(location.href);
  if (url.searchParams.has('search')) history.back();
  else hideDialog();
}

document.addEventListener('input', event => {
  const input = event.target;
  if (input.classList && input.classList.contains('barsearch')) {
    showSuggest(input.value);
  }
}, true);

document.addEventListener('focusin', event => {
  const input = event.target;
  if (input.classList && input.classList.contains('barsearch')) showSuggest(input.value);
});

document.addEventListener('click', event => {
  if (!suggest.hidden && !suggest.contains(event.target) &&
      !(event.target.classList && event.target.classList.contains('barsearch'))) {
    hideSuggest();
  }
});

suggestButton.addEventListener('click', () => showDialog(suggestQuery.textContent, true));
closeButton.addEventListener('click', closeFromUser);
dialogQuery.addEventListener('input', () => {
  render(dialogQuery.value);
  const url = new URL(location.href);
  url.searchParams.set('search', dialogQuery.value.trim());
  history.replaceState({...history.state, oncosSearch: dialogQuery.value.trim()}, '', url);
});

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
  const query = new URL(location.href).searchParams.get('search');
  if (query && ready) showDialog(query, false);
  else hideDialog();
});

bootstrap().then(() => {
  const query = new URL(location.href).searchParams.get('search');
  if (query && ready) showDialog(query, false);
});
