import { mountChrome, loadContent, tracker, esc, el, companyChip, readQuery, writeQuery, debounce, hostOf } from '../app.js';

mountChrome('questions', { title: 'Questions' });

const data = await loadContent('questions.json');
const done = tracker('questions');
const roundName = new Map(data.rounds.map((r) => [r.id, r.name]));
const items = data.items.map((q, i) => ({ ...q, id: `q${i}-${hash(q.q)}` }));

const roundSel = document.getElementById('round');
for (const r of data.rounds) roundSel.append(el(`<option value="${esc(r.id)}">${esc(r.name)}</option>`));

const controls = { q: document.getElementById('q'), company: document.getElementById('company'), round: roundSel, tag: document.getElementById('tag'), done: document.getElementById('done') };
const initial = readQuery();
for (const [key, control] of Object.entries(controls)) if (initial[key]) control.value = initial[key];

const list = document.getElementById('list');
const count = document.getElementById('count');

function render() {
  const query = controls.q.value.trim().toLowerCase();
  const filters = { company: controls.company.value, round: controls.round.value, tag: controls.tag.value, done: controls.done.value };
  writeQuery({ q: controls.q.value.trim(), ...filters });
  const shown = items.filter((item) => {
    if (filters.company && item.company !== filters.company) return false;
    if (filters.round && item.round !== filters.round) return false;
    if (filters.tag && item.tag !== filters.tag) return false;
    if (filters.done === 'open' && done.has(item.id)) return false;
    if (filters.done === 'done' && !done.has(item.id)) return false;
    if (query && !`${item.q} ${item.company} ${item.round} ${item.shape || ''}`.toLowerCase().includes(query)) return false;
    return true;
  });
  count.textContent = `${shown.length} of ${items.length} questions · ${done.count()} practiced`;
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = '<div class="empty">Nothing matches. Clear a filter.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const item of shown) {
    const src = data.sources[item.source];
    const card = el(`<article class="item ${done.has(item.id) ? 'done' : ''}">
      <div class="meta">${companyChip(item.company)}<span class="chip plain">${esc(roundName.get(item.round) || item.round)}</span><span class="chip tag-${esc(item.tag)}" title="${esc(data.tags[item.tag])}">${esc(item.tag)}</span>${item.shape ? `<span class="chip plain">${esc(item.shape)}</span>` : ''}</div>
      <p class="title" style="margin:0">${esc(item.q)}</p>
      <div class="meta">
        <label class="check" style="min-height:36px;padding:0"><input type="checkbox" ${done.has(item.id) ? 'checked' : ''}><span>Practiced</span></label>
        ${src ? `<span>·</span><a href="${esc(src)}" target="_blank" rel="noopener">source: ${esc(hostOf(src))}</a>` : ''}
      </div>
    </article>`);
    card.querySelector('input').addEventListener('change', (event) => {
      done.set(item.id, event.target.checked);
      card.classList.toggle('done', event.target.checked);
      count.textContent = `${shown.length} of ${items.length} questions · ${done.count()} practiced`;
    });
    frag.append(card);
  }
  list.append(frag);
}

controls.q.addEventListener('input', debounce(render));
for (const key of ['company', 'round', 'tag', 'done']) controls[key].addEventListener('change', render);
render();

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
