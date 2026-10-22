// Shared runtime: theme, header/footer, data loading, localStorage store, small helpers.
// Every page imports this module and calls mountChrome(pageId).

const BASE = (() => {
  // Works at / and at /frontier-prep/ (GitHub Pages) because every page sits at the root.
  const path = location.pathname;
  return path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
})();

export const NAV = [
  ['index.html', 'Home', 'home'],
  ['roadmap.html', 'Roadmap', 'roadmap'],
  ['practice.html', 'Practice', 'practice'],
  ['questions.html', 'Questions', 'questions'],
  ['resources.html', 'Resources', 'resources'],
  ['companies.html', 'Companies', 'companies'],
  ['feed.html', 'Feed', 'feed'],
  ['jobs.html', 'Jobs', 'jobs'],
];

const STORE_PREFIX = 'frontier-prep.v1.';

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage full or disabled: fail quietly */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(STORE_PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX)) out.push(k.slice(STORE_PREFIX.length));
    }
    return out;
  },
};

// A set-like tracker stored as an object of id -> ISO date, so "done on" survives.
export function tracker(name) {
  const data = store.get(name, {});
  return {
    has: (id) => Boolean(data[id]),
    when: (id) => data[id] || null,
    toggle(id) {
      if (data[id]) delete data[id];
      else data[id] = new Date().toISOString();
      store.set(name, data);
      return Boolean(data[id]);
    },
    set(id, value) {
      if (value) data[id] = data[id] || new Date().toISOString();
      else delete data[id];
      store.set(name, data);
    },
    count: () => Object.keys(data).length,
    ids: () => Object.keys(data),
  };
}

// Theme: light first paint regardless of OS; "system" follows the OS once chosen.
const THEMES = ['light', 'dark', 'system'];
export function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themeChoice = choice;
}
export function initTheme() {
  const choice = store.get('theme', 'light');
  applyTheme(THEMES.includes(choice) ? choice : 'light');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (store.get('theme', 'light') === 'system') applyTheme('system');
  });
}
function cycleTheme() {
  const current = store.get('theme', 'light');
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  store.set('theme', next);
  applyTheme(next);
  return next;
}
const THEME_ICON = { light: '☀', dark: '☾', system: '◐' };

export function mountChrome(pageId, { title } = {}) {
  initTheme();
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `
    <div class="bar">
      <a class="brand" href="${BASE}index.html" aria-label="Frontier Prep home">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20 12 4l9 16H3Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20l4-7 4 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        Frontier Prep
      </a>
      <nav class="primary" aria-label="Primary">
        ${NAV.map(([href, label, id]) => `<a href="${BASE}${href}" ${id === pageId ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <button class="theme-toggle" type="button" aria-label="Theme: light. Press to change" title="Theme (t)">${THEME_ICON.light}</button>
    </div>`;
  document.body.prepend(header);
  const toggle = header.querySelector('.theme-toggle');
  const reflect = (choice) => {
    toggle.textContent = THEME_ICON[choice];
    toggle.setAttribute('aria-label', `Theme: ${choice}. Press to change`);
  };
  reflect(store.get('theme', 'light'));
  toggle.addEventListener('click', () => reflect(cycleTheme()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 't' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target)) reflect(cycleTheme());
  });

  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `
    <div class="inner">
      <span>Frontier Prep · built by Sudish Kumar · data refreshes every 6 hours on GitHub Actions · <span data-generated>loading…</span></span>
      <span><a href="https://github.com/Sudish007/frontier-prep">Source</a> · progress is stored in this browser only</span>
    </div>`;
  document.body.append(footer);
  if (title) document.title = `${title} · Frontier Prep`;
  loadData('meta.json')
    .then((meta) => {
      footer.querySelector('[data-generated]').textContent = `data generated ${formatDate(meta.generatedAt, true)}`;
    })
    .catch(() => {
      footer.querySelector('[data-generated]').textContent = 'data not yet generated';
    });
}

function isTyping(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

const cache = new Map();
export function loadContent(name) {
  return loadJson(`${BASE}content/${name}`);
}
export function loadData(name) {
  return loadJson(`${BASE}data/${name}?v=${Math.floor(Date.now() / 300_000)}`);
}
async function loadJson(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  });
  cache.set(url, promise);
  return promise;
}

export function formatDate(iso, withTime = false) {
  if (!iso) return 'undated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'undated';
  const opts = withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleString('en-IN', opts);
}
export function relativeDays(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (diff < 1) return 'today';
  if (diff < 2) return 'yesterday';
  if (diff < 30) return `${Math.floor(diff)} d ago`;
  return formatDate(iso);
}
export function daysUntil(iso) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const COMPANY_LABEL = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google / DeepMind', microsoft: 'Microsoft', amazon: 'Amazon', all: 'Any company' };
export const COMPANY_COLOR = { anthropic: '#c96a3c', openai: '#2f7d6d', google: '#3b6fd1', microsoft: '#6b5bd2', amazon: '#c9871f', all: '#5b6472' };
export function companyChip(id) {
  return `<span class="chip company" style="background:${COMPANY_COLOR[id] || '#5b6472'}">${esc(COMPANY_LABEL[id] || id)}</span>`;
}

// URL query helpers for shareable filters.
export function readQuery() {
  return Object.fromEntries(new URLSearchParams(location.search).entries());
}
export function writeQuery(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// Practice log shared by Practice and Home.
export function practiceLog() {
  const log = store.get('practice', []);
  return {
    all: () => log,
    add(entry) {
      log.push(entry);
      store.set('practice', log);
    },
    remove(id) {
      const i = log.findIndex((e) => e.id === id);
      if (i >= 0) log.splice(i, 1);
      store.set('practice', log);
    },
    counts() {
      const out = { coding: 0, design: 0, mock: 0, chat: 0, pr: 0, reading: 0, project: 0 };
      for (const e of log) out[e.kind] = (out[e.kind] || 0) + 1;
      return out;
    },
  };
}

export function exportAll() {
  const out = {};
  for (const key of store.keys()) out[key] = store.get(key);
  return { app: 'frontier-prep', version: 1, exportedAt: new Date().toISOString(), data: out };
}
export function importAll(payload) {
  if (!payload || payload.app !== 'frontier-prep' || typeof payload.data !== 'object') throw new Error('not a Frontier Prep export');
  for (const [key, value] of Object.entries(payload.data)) {
    if (key === 'practice' && Array.isArray(value)) {
      const existing = store.get('practice', []);
      const ids = new Set(existing.map((e) => e.id));
      store.set('practice', existing.concat(value.filter((e) => !ids.has(e.id))));
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      store.set(key, { ...store.get(key, {}), ...value });
    } else {
      store.set(key, value);
    }
  }
}
export function resetAll() {
  const theme = store.get('theme', 'light');
  for (const key of store.keys()) store.remove(key);
  store.set('theme', theme);
}
