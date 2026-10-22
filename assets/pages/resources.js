import { mountChrome, loadContent, loadData, tracker, esc, el, companyChip, hostOf, readQuery, writeQuery, debounce, relativeDays } from '../app.js';

mountChrome('resources', { title: 'Resources' });

const [data, discovered] = await Promise.all([loadContent('resources.json'), loadData('discovered.json').catch(() => ({ items: [] }))]);
const done = tracker('resources');
const dismissed = tracker('discovered-dismissed');
const pillarById = new Map(data.pillars.map((p) => [p.id, p]));

// Filters
const controls = {
  q: document.getElementById('q'),
  pillar: document.getElementById('pillar'),
  kind: document.getElementById('kind'),
  cost: document.getElementById('cost'),
  level: document.getElementById('level'),
  company: document.getElementById('company'),
  priority: document.getElementById('priority'),
  done: document.getElementById('done'),
};
for (const p of data.pillars) controls.pillar.append(el(`<option value="${esc(p.id)}">${esc(p.name)}</option>`));
for (const kind of [...new Set(data.items.map((r) => r.kind))].sort()) controls.kind.append(el(`<option value="${esc(kind)}">${esc(kind)}</option>`));
const initial = readQuery();
for (const [key, control] of Object.entries(controls)) if (initial[key]) control.value = initial[key];

const list = document.getElementById('list');
const count = document.getElementById('count');
const blurb = document.getElementById('pillar-blurb');
const PRIORITY_LABEL = { 1: 'do first', 2: 'next', 3: 'later' };

function render() {
  const query = controls.q.value.trim().toLowerCase();
  const f = Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, c.value]));
  writeQuery({ ...f, q: controls.q.value.trim(), view: currentView === 'discovered' ? 'discovered' : '' });
  const shown = data.items
    .filter((r) => {
      if (f.pillar && r.pillar !== f.pillar) return false;
      if (f.kind && r.kind !== f.kind) return false;
      if (f.cost && r.cost !== f.cost) return false;
      if (f.level && r.level !== f.level) return false;
      if (f.company && !(r.companies.includes(f.company) || r.companies.includes('all'))) return false;
      if (f.priority && String(r.priority) !== f.priority) return false;
      if (f.done === 'open' && done.has(r.id)) return false;
      if (f.done === 'done' && !done.has(r.id)) return false;
      if (query && !`${r.title} ${r.why} ${r.kind} ${r.pillar} ${hostOf(r.url)}`.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  const hours = shown.reduce((a, r) => a + (Number(r.hours) || 0), 0);
  count.textContent = `${shown.length} of ${data.items.length} resources · about ${Math.round(hours)} hours · ${done.count()} done`;
  if (f.pillar && pillarById.get(f.pillar)) {
    blurb.hidden = false;
    blurb.innerHTML = `<strong>${esc(pillarById.get(f.pillar).name)}.</strong> ${esc(pillarById.get(f.pillar).blurb)}`;
  } else {
    blurb.hidden = true;
  }
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = '<div class="empty">Nothing matches. Clear a filter.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of shown) {
    const card = el(`<article class="card ${done.has(r.id) ? 'done' : ''}">
      <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></h3>
      <div class="meta">
        <span class="chip ${r.priority === 1 ? '' : 'plain'}">P${r.priority} · ${PRIORITY_LABEL[r.priority]}</span>
        <span class="chip plain">${esc(r.kind)}</span>
        <span class="chip plain">${esc(r.cost)}</span>
        <span class="chip plain">${esc(r.level)}</span>
        <span>~${esc(r.hours)} h</span>
        <span>${esc(hostOf(r.url))}</span>
      </div>
      <p class="why">${esc(r.why)}</p>
      <div class="meta">${r.companies.map(companyChip).join('')}<span class="chip plain wrap">${esc(pillarById.get(r.pillar)?.name || r.pillar)}</span></div>
      <label class="check" style="min-height:36px;padding:0"><input type="checkbox" ${done.has(r.id) ? 'checked' : ''}><span>Done</span></label>
    </article>`);
    card.querySelector('input').addEventListener('change', (event) => {
      done.set(r.id, event.target.checked);
      card.classList.toggle('done', event.target.checked);
      count.textContent = `${shown.length} of ${data.items.length} resources · about ${Math.round(hours)} hours · ${done.count()} done`;
    });
    frag.append(card);
  }
  list.append(frag);
}
controls.q.addEventListener('input', debounce(render));
for (const key of Object.keys(controls)) if (key !== 'q') controls[key].addEventListener('change', render);

// Discovered view
const discList = document.getElementById('disc-list');
const discKind = document.getElementById('disc-kind');
const discHide = document.getElementById('disc-hide');
document.getElementById('disc-count').textContent = discovered.items.length ? `(${discovered.items.length})` : '';
function renderDiscovered() {
  const shown = discovered.items.filter((d) => (!discKind.value || d.kind === discKind.value) && !(discHide.value === 'open' && dismissed.has(d.id)));
  discList.innerHTML = '';
  if (!shown.length) {
    discList.innerHTML = '<div class="empty">Nothing discovered yet. The next scheduled refresh will populate this.</div>';
    return;
  }
  for (const d of shown) {
    const item = el(`<article class="item ${dismissed.has(d.id) ? 'done' : ''}" style="${dismissed.has(d.id) ? 'opacity:0.6' : ''}">
      <a class="title" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>
      ${d.summary ? `<p class="summary">${esc(d.summary)}</p>` : ''}
      <div class="meta"><span class="chip">${esc(d.kind)}</span><span>${esc(d.sourceName)}</span><span>·</span><span>${esc(relativeDays(d.publishedAt || d.firstSeen))}</span><span>·</span><span>${esc(hostOf(d.url))}</span>
        <button type="button" class="btn-sm" data-dismiss>${dismissed.has(d.id) ? 'Restore' : 'Dismiss'}</button></div>
    </article>`);
    item.querySelector('[data-dismiss]').addEventListener('click', () => {
      dismissed.toggle(d.id);
      renderDiscovered();
    });
    discList.append(item);
  }
}
discKind.addEventListener('change', renderDiscovered);
discHide.addEventListener('change', renderDiscovered);

// View switch
let currentView = initial.view === 'discovered' ? 'discovered' : 'library';
const views = { library: document.getElementById('library'), discovered: document.getElementById('discovered') };
const buttons = [...document.querySelectorAll('[data-view]')];
function showView(name) {
  currentView = name;
  for (const [key, section] of Object.entries(views)) section.hidden = key !== name;
  for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.view === name));
  render();
}
for (const b of buttons) b.addEventListener('click', () => showView(b.dataset.view));
showView(currentView);
renderDiscovered();
