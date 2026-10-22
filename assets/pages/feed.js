import { mountChrome, loadData, tracker, esc, el, formatDate, relativeDays, hostOf, readQuery, writeQuery, debounce } from '../app.js';

mountChrome('feed', { title: 'Feed' });

const [feed, meta] = await Promise.all([loadData('feed.json').catch(() => ({ items: [] })), loadData('meta.json').catch(() => null)]);
const read = tracker('feed-read');
const saved = tracker('feed-saved');
document.getElementById('generated').textContent = meta ? `Data generated ${formatDate(meta.generatedAt, true)} · ${feed.items.length} items in the last ${meta.windowDays} days.` : 'No data yet.';

const controls = { q: document.getElementById('q'), topic: document.getElementById('topic'), kind: document.getElementById('kind'), source: document.getElementById('source'), read: document.getElementById('read') };
const topics = [...new Set(feed.items.flatMap((i) => i.topics))].sort();
for (const t of topics) controls.topic.append(el(`<option value="${esc(t)}">${esc(t)}</option>`));
const kinds = [...new Set((meta?.sources || []).map((s) => s.kind))].sort();
for (const k of kinds) controls.kind.append(el(`<option value="${esc(k)}">${esc(k)}</option>`));
const sourceKind = new Map((meta?.sources || []).map((s) => [s.id, s.kind]));
const sourceNames = [...new Map(feed.items.map((i) => [i.source, i.sourceName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
for (const [id, name] of sourceNames) controls.source.append(el(`<option value="${esc(id)}">${esc(name)}</option>`));
const initial = readQuery();
for (const [key, control] of Object.entries(controls)) if (initial[key]) control.value = initial[key];

const list = document.getElementById('list');
const count = document.getElementById('count');
const more = document.getElementById('more');
const PAGE = 60;
let shown = [];
let visible = PAGE;

function filterItems() {
  const query = controls.q.value.trim().toLowerCase();
  const f = { topic: controls.topic.value, kind: controls.kind.value, source: controls.source.value, read: controls.read.value };
  writeQuery({ q: controls.q.value.trim(), ...f });
  return feed.items.filter((i) => {
    if (f.topic && !i.topics.includes(f.topic)) return false;
    if (f.kind && sourceKind.get(i.source) !== f.kind) return false;
    if (f.source && i.source !== f.source) return false;
    if (f.read === 'unread' && read.has(i.id)) return false;
    if (f.read === 'saved' && !saved.has(i.id)) return false;
    if (query && !`${i.title} ${i.summary} ${i.sourceName}`.toLowerCase().includes(query)) return false;
    return true;
  });
}
function render(resetPage = true) {
  if (resetPage) visible = PAGE;
  shown = filterItems();
  count.textContent = `${shown.length} items · ${saved.count()} saved`;
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = '<div class="empty">Nothing matches, or the feed has not been generated yet.</div>';
    more.hidden = true;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const i of shown.slice(0, visible)) frag.append(renderItem(i));
  list.append(frag);
  more.hidden = shown.length <= visible;
}
function renderItem(i) {
  const node = el(`<article class="item" style="${read.has(i.id) ? 'opacity:0.65' : ''}">
    <a class="title" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
    ${i.summary ? `<p class="summary">${esc(i.summary)}</p>` : ''}
    <div class="meta">
      <span class="chip plain">${esc(sourceKind.get(i.source) || i.class)}</span><span>${esc(i.sourceName)}</span><span>·</span>
      <span title="${esc(i.publishedAt ? formatDate(i.publishedAt, true) : `first seen ${formatDate(i.firstSeen, true)}`)}">${esc(i.publishedAt ? relativeDays(i.publishedAt) : `seen ${relativeDays(i.firstSeen)}`)}</span>
      <span>·</span><span>${esc(hostOf(i.url))}</span>
      ${i.topics.map((t) => `<span class="chip plain">${esc(t)}</span>`).join('')}
      <button type="button" class="btn-sm" data-save>${saved.has(i.id) ? 'Saved ✓' : 'Save'}</button>
    </div>
  </article>`);
  node.querySelector('.title').addEventListener('click', () => {
    read.set(i.id, true);
    node.style.opacity = '0.65';
  });
  node.querySelector('[data-save]').addEventListener('click', (event) => {
    const on = saved.toggle(i.id);
    event.target.textContent = on ? 'Saved ✓' : 'Save';
    count.textContent = `${shown.length} items · ${saved.count()} saved`;
  });
  return node;
}
more.addEventListener('click', () => {
  visible += PAGE;
  render(false);
});
controls.q.addEventListener('input', debounce(() => render()));
for (const key of ['topic', 'kind', 'source', 'read']) controls[key].addEventListener('change', () => render());
render();

// Source status table
const sources = document.getElementById('sources');
if (!meta) {
  sources.innerHTML = '<div class="empty">No meta.json yet.</div>';
} else {
  const statusChip = (s) => (s.status === 'ok' ? 'ok' : s.status === 'empty' ? 'plain' : s.status === 'failed' ? 'bad' : 'warn');
  sources.innerHTML = `<table>
    <thead><tr><th>Source</th><th>Kind</th><th>Status</th><th>Items</th><th>Newest</th><th>Note</th></tr></thead>
    <tbody>${meta.sources.map((s) => `<tr>
      <td>${s.homepage ? `<a href="${esc(s.homepage)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</td>
      <td>${esc(s.kind)}</td>
      <td><span class="chip ${statusChip(s)}">${esc(s.status)}</span>${s.status === 'failed' ? `<br><span class="muted">unavailable since ${formatDate(s.failingSince)}: ${esc(s.error)}</span>` : ''}</td>
      <td>${s.count}</td>
      <td>${s.newest ? esc(relativeDays(s.newest)) : '—'}</td>
      <td class="muted">${esc(s.note || '')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}
