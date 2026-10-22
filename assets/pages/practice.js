import { mountChrome, loadContent, practiceLog, esc, el, formatDate, daysUntil, companyChip } from '../app.js';

mountChrome('practice', { title: 'Practice' });

const [roadmap, questions] = await Promise.all([loadContent('roadmap.json'), loadContent('questions.json')]);
const log = practiceLog();

const promptEl = document.getElementById('prompt');
const kindEl = document.getElementById('drill-kind');
const companyEl = document.getElementById('drill-company');
const minutesEl = document.getElementById('drill-minutes');
let current = null;

function draw() {
  const kind = kindEl.value;
  const company = companyEl.value;
  if (kind === 'coding') {
    const shape = pick(roadmap.shapes);
    const related = questions.items.filter((q) => q.shape === shape.id && (!company || q.company === company || q.company === 'all'));
    current = { kind: 'coding', shape: shape.id, label: shape.name };
    promptEl.innerHTML = `
      <h3 style="margin-top:0">${esc(shape.name)}</h3>
      <p class="muted" style="margin:0">Build stage 1 with tests in the first third of the time, then extend. Narrate requirements and tradeoffs out loud.</p>
      <div class="stages">${shape.stages.map((s, i) => `<div class="stage"><b>Stage ${i + 1}</b>${esc(s)}</div>`).join('')}</div>
      ${related.length ? `<p style="margin:0.8rem 0 0"><strong>As asked:</strong> ${esc(pick(related).q)}</p>` : ''}`;
    return;
  }
  const rounds = kind === 'question' ? null : kind === 'design' ? ['design'] : ['values', 'behavioral'];
  const pool = questions.items.filter((q) => (!rounds || rounds.includes(q.round)) && (!company || q.company === company || q.company === 'all'));
  if (!pool.length) {
    promptEl.innerHTML = '<p class="muted" style="margin:0">No prompts match these filters.</p>';
    return;
  }
  const q = pick(pool);
  current = { kind: kind === 'design' ? 'design' : 'coding', label: q.q.slice(0, 80), round: q.round, company: q.company };
  promptEl.innerHTML = `
    <div class="meta" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem">${companyChip(q.company)}<span class="chip plain">${esc(q.round)}</span><span class="chip tag-${esc(q.tag)}">${esc(q.tag)}</span></div>
    <p style="margin:0;font-size:1.1rem">${esc(q.q)}</p>`;
  if (kind === 'values') current.kind = 'mock';
}
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
document.getElementById('draw').addEventListener('click', draw);

// Timer
const timerEl = document.getElementById('timer');
let remaining = Number(minutesEl.value) * 60;
let ticking = null;
let startedAt = null;
function render() {
  const sign = remaining < 0 ? '-' : '';
  const abs = Math.abs(remaining);
  timerEl.textContent = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  timerEl.classList.toggle('over', remaining < 0);
  document.title = ticking ? `${timerEl.textContent} · Practice · Frontier Prep` : 'Practice · Frontier Prep';
}
function start() {
  if (ticking) return;
  startedAt = startedAt || new Date().toISOString();
  ticking = setInterval(() => {
    remaining -= 1;
    render();
    if (remaining === 0 && 'Notification' in window && Notification.permission === 'granted') new Notification('Time is up', { body: current?.label || 'Practice session' });
  }, 1000);
  render();
}
function pause() {
  clearInterval(ticking);
  ticking = null;
  render();
}
function reset() {
  pause();
  remaining = Number(minutesEl.value) * 60;
  startedAt = null;
  render();
}
minutesEl.addEventListener('change', () => {
  if (!ticking) reset();
});
document.getElementById('start').addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  start();
});
document.getElementById('pause').addEventListener('click', pause);
document.getElementById('resetTimer').addEventListener('click', reset);
document.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
  if (typing) return;
  if (event.key === ' ') {
    event.preventDefault();
    ticking ? pause() : start();
  }
  if (event.key === 'd') draw();
});
render();

// Logging
document.getElementById('log').addEventListener('click', () => {
  const planned = Number(minutesEl.value);
  const spent = Math.max(1, Math.round((planned * 60 - remaining) / 60));
  log.add({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: current?.kind === 'design' ? 'design' : current?.kind === 'mock' ? 'mock' : 'coding',
    label: current?.label || 'Untitled session',
    shape: current?.shape || null,
    company: current?.company || companyEl.value || null,
    outcome: document.getElementById('log-outcome').value,
    minutes: ticking || remaining !== planned * 60 ? spent : planned,
    notes: document.getElementById('log-notes').value.trim(),
    at: startedAt || new Date().toISOString(),
  });
  document.getElementById('log-notes').value = '';
  reset();
  renderTotals();
  renderHistory();
});
document.getElementById('other-log').addEventListener('click', () => {
  const notes = document.getElementById('other-notes').value.trim();
  log.add({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: document.getElementById('other-kind').value,
    label: notes || document.getElementById('other-kind').selectedOptions[0].textContent,
    notes,
    at: new Date().toISOString(),
  });
  document.getElementById('other-notes').value = '';
  renderTotals();
  renderHistory();
});

// Totals
const KIND_LABEL = { coding: 'Timed coding sessions', design: 'Designs', mock: 'Mock loops', chat: 'Informational chats', pr: 'Merged PRs', reading: 'Readings with notes', project: 'Flagship sessions' };
function renderTotals() {
  const counts = log.counts();
  const cp = roadmap.checkpoints.find((c) => daysUntil(c.date) >= 0) || roadmap.checkpoints.at(-1);
  const targetFor = { coding: cp.metrics.sessions, design: cp.metrics.designs, mock: cp.metrics.mocks, chat: cp.metrics.chats, pr: cp.metrics.prs };
  const totals = document.getElementById('totals');
  totals.innerHTML = '';
  for (const kind of Object.keys(KIND_LABEL)) {
    const have = counts[kind] || 0;
    const target = targetFor[kind];
    const pct = target ? Math.min(100, Math.round((have / target) * 100)) : null;
    totals.append(el(`<div class="card">
      <h3>${esc(KIND_LABEL[kind])}</h3>
      <b style="font-size:1.6rem">${have}${target ? ` <span class="muted" style="font-size:1rem">/ ${target} by ${formatDate(cp.date)}</span>` : ''}</b>
      ${pct != null ? `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(KIND_LABEL[kind])}"><span style="width:${pct}%"></span></div>` : ''}
    </div>`));
  }
}

// History
function renderHistory() {
  const entries = [...log.all()].sort((a, b) => (a.at < b.at ? 1 : -1));
  const wrap = document.getElementById('history');
  if (!entries.length) {
    wrap.innerHTML = '<div class="empty">No sessions logged yet.</div>';
    return;
  }
  wrap.innerHTML = `<table>
    <thead><tr><th>When</th><th>Kind</th><th>What</th><th>Outcome</th><th>Min</th><th>Notes</th><th></th></tr></thead>
    <tbody>${entries.map((e) => `<tr data-id="${esc(e.id)}">
      <td>${formatDate(e.at, true)}</td><td>${esc(e.kind)}</td><td>${esc(e.label)}${e.company ? ` ${companyChip(e.company)}` : ''}</td>
      <td>${esc(e.outcome || '')}</td><td>${e.minutes ?? ''}</td><td>${esc(e.notes || '')}</td>
      <td><button type="button" class="danger" data-remove aria-label="Remove this entry">×</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
  wrap.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('tr').dataset.id;
      if (confirm('Remove this entry?')) {
        log.remove(id);
        renderTotals();
        renderHistory();
      }
    });
  });
}

// Shapes reference
const shapes = document.getElementById('shapes');
for (const shape of roadmap.shapes) {
  const asked = questions.items.filter((q) => q.shape === shape.id);
  shapes.append(el(`<div class="card">
    <h3>${esc(shape.name)}</h3>
    <ol style="margin:0">${shape.stages.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="meta">${[...new Set(asked.map((q) => q.company))].map(companyChip).join('')}${asked.length ? `<span>${asked.length} reported variant${asked.length > 1 ? 's' : ''}</span>` : ''}</div>
  </div>`));
}

renderTotals();
renderHistory();
