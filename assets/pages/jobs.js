import { mountChrome, loadData, tracker, store, esc, el, formatDate, relativeDays, companyChip, readQuery, writeQuery, debounce } from '../app.js';

mountChrome('jobs', { title: 'Jobs' });

const [jobs, meta] = await Promise.all([loadData('jobs.json').catch(() => ({ items: [] })), loadData('meta.json').catch(() => null)]);
const saved = tracker('jobs-saved');
const lastVisit = store.get('jobs-last-visit', null);
store.set('jobs-last-visit', new Date().toISOString());
document.getElementById('generated').textContent = meta ? `Data generated ${formatDate(meta.generatedAt, true)} · ${jobs.items.length} matching roles, ${jobs.items.filter((j) => j.india).length} in India.` : 'No data yet.';

const controls = { q: document.getElementById('q'), company: document.getElementById('company'), loc: document.getElementById('loc'), seen: document.getElementById('seen') };
for (const c of [...new Set(jobs.items.map((j) => j.company))].sort()) controls.company.append(el(`<option value="${esc(c)}">${esc(c)}</option>`));
const initial = readQuery();
for (const [key, control] of Object.entries(controls)) if (initial[key] != null) control.value = initial[key];

const list = document.getElementById('list');
const count = document.getElementById('count');
function render() {
  const query = controls.q.value.trim().toLowerCase();
  const f = { company: controls.company.value, loc: controls.loc.value, seen: controls.seen.value };
  writeQuery({ q: controls.q.value.trim(), ...f, loc: f.loc === 'india' ? '' : f.loc || 'any' });
  const shown = jobs.items.filter((j) => {
    if (f.company && j.company !== f.company) return false;
    if (f.loc === 'india' && !j.india) return false;
    if (f.loc === 'remote' && !j.remote) return false;
    if (f.loc === 'india-remote' && !(j.india || j.remote)) return false;
    if (f.seen === 'new' && lastVisit && j.firstSeen <= lastVisit) return false;
    if (f.seen === 'saved' && !saved.has(j.id)) return false;
    if (query && !`${j.title} ${j.location} ${j.company}`.toLowerCase().includes(query)) return false;
    return true;
  });
  count.textContent = `${shown.length} roles · ${saved.count()} saved${lastVisit ? ` · last visit ${relativeDays(lastVisit)}` : ''}`;
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = '<div class="empty">No roles match. Widen the location filter, or check the boards table below for failures.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const j of shown) {
    const isNew = lastVisit && j.firstSeen > lastVisit;
    const node = el(`<article class="item">
      <a class="title" href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>
      <div class="meta">${companyChip(j.company.toLowerCase().split(' ')[0])}<span>${esc(j.location || 'location not listed')}</span>
        ${j.india ? '<span class="chip ok">India</span>' : ''}${j.remote ? '<span class="chip plain">Remote</span>' : ''}${isNew ? '<span class="chip warn">new</span>' : ''}
        <span>·</span><span title="${esc(j.postedAt ? `posted ${formatDate(j.postedAt, true)}` : `first seen ${formatDate(j.firstSeen, true)}`)}">${esc(j.postedAt ? `posted ${relativeDays(j.postedAt)}` : `seen ${relativeDays(j.firstSeen)}`)}</span>
        <button type="button" class="btn-sm" data-save>${saved.has(j.id) ? 'Saved ✓' : 'Save'}</button>
      </div>
    </article>`);
    node.querySelector('[data-save]').addEventListener('click', (event) => {
      const on = saved.toggle(j.id);
      event.target.textContent = on ? 'Saved ✓' : 'Save';
    });
    frag.append(node);
  }
  list.append(frag);
}
if (initial.loc === 'any') controls.loc.value = '';
controls.q.addEventListener('input', debounce(render));
for (const key of ['company', 'loc', 'seen']) controls[key].addEventListener('change', render);
render();

const boards = document.getElementById('boards');
if (!meta) {
  boards.innerHTML = '<div class="empty">No meta.json yet.</div>';
} else {
  const chip = (s) => (s === 'ok' ? 'ok' : s === 'failed' ? 'bad' : s === 'manual' ? 'warn' : 'plain');
  boards.innerHTML = `<table>
    <thead><tr><th>Company</th><th>Board</th><th>Status</th><th>Matching roles</th><th>Link</th></tr></thead>
    <tbody>${meta.jobBoards.map((b) => `<tr>
      <td>${esc(b.company)}</td><td>${esc(b.kind)}</td>
      <td><span class="chip ${chip(b.status)}">${esc(b.status)}</span>${b.error ? `<br><span class="muted">${esc(b.error)}</span>` : ''}${b.status === 'manual' ? '<br><span class="muted">no public JSON endpoint; check by hand</span>' : ''}</td>
      <td>${b.count}</td>
      <td>${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">open board</a>` : '—'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}
