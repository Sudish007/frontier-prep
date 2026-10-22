import { mountChrome, loadContent, tracker, practiceLog, esc, el, formatDate, daysUntil, companyChip, exportAll, importAll, resetAll } from '../app.js';

mountChrome('roadmap', { title: 'Roadmap' });

const [roadmap, resources] = await Promise.all([loadContent('roadmap.json'), loadContent('resources.json')]);
const byId = new Map(resources.items.map((r) => [r.id, r]));
const doneTasks = tracker('tasks');
const doneResources = tracker('resources');
const counts = practiceLog().counts();

document.getElementById('lede').textContent = `${roadmap.horizon}. Positioning: “${roadmap.positioning}” About ${roadmap.weeklyHours} hours a week.`;

// Targets
const targets = document.getElementById('targets');
for (const [tier, label] of [['tier1', 'Tier 1 · aim for a loop within 6–12 months'], ['tier2', 'Tier 2 · 12–24 months'], ['tier3', 'Tier 3 · 24–36+ months']]) {
  targets.append(el(`<h3>${esc(label)}</h3>`));
  const ul = el('<ul></ul>');
  for (const t of roadmap.targets[tier]) ul.append(el(`<li>${companyChip(t.company)} <strong>${esc(t.role)}</strong>${t.why ? ` <span class="muted">— ${esc(t.why)}</span>` : ''}</li>`));
  targets.append(ul);
}

// Gaps
document.getElementById('gaps').innerHTML = `<table>
  <thead><tr><th>Dimension</th><th>Where you are</th><th>What the loop rewards</th><th>Gap-closing move</th></tr></thead>
  <tbody>${roadmap.gaps.map((g) => `<tr><td><strong>${esc(g.dimension)}</strong></td><td>${esc(g.now)}</td><td>${esc(g.bar)}</td><td>${esc(g.move)}</td></tr>`).join('')}</tbody>
</table>`;

// Phases
const phases = document.getElementById('phases');
for (const phase of roadmap.phases) {
  const current = daysUntil(phase.from) <= 0 && daysUntil(phase.to) >= 0;
  const done = phase.tasks.filter((t) => doneTasks.has(t.id)).length;
  const section = el(`<section class="phase ${current ? 'current' : ''}">
    <h3>${esc(phase.name)} ${current ? '<span class="chip">current</span>' : ''}</h3>
    <div class="dates">${formatDate(phase.from)} → ${formatDate(phase.to)} · <span data-count>${done}</span> of ${phase.tasks.length} done</div>
    <p>${esc(phase.goal)}</p>
    <div data-tasks></div>
  </section>`);
  const list = section.querySelector('[data-tasks]');
  for (const task of phase.tasks) {
    const checked = doneTasks.has(task.id);
    const label = el(`<label class="check ${checked ? 'done' : ''}"><input type="checkbox" ${checked ? 'checked' : ''}><span>${esc(task.text)}</span></label>`);
    label.querySelector('input').addEventListener('change', (event) => {
      doneTasks.set(task.id, event.target.checked);
      label.classList.toggle('done', event.target.checked);
      section.querySelector('[data-count]').textContent = phase.tasks.filter((t) => doneTasks.has(t.id)).length;
    });
    list.append(label);
  }
  phases.append(section);
}

// Checkpoints
document.getElementById('checkpoints').innerHTML = `<table>
  <thead><tr><th>Date</th><th>Must be true</th><th>Your log</th><th>If not</th></tr></thead>
  <tbody>${roadmap.checkpoints.map((c) => {
    const days = daysUntil(c.date);
    const metrics = Object.entries(c.metrics || {}).map(([k, target]) => {
      const have = { sessions: counts.coding, designs: counts.design, prs: counts.pr, mocks: counts.mock, chats: counts.chat }[k] ?? 0;
      return `<span class="chip ${have >= target ? 'ok' : 'plain'}">${esc(k)} ${have}/${target}</span>`;
    }).join(' ');
    return `<tr><td><strong>${formatDate(c.date)}</strong><br><span class="muted">${days >= 0 ? `in ${days} days` : 'passed'}</span></td><td>${esc(c.must)}</td><td>${metrics || '—'}</td><td>${esc(c.ifNot)}</td></tr>`;
  }).join('')}</tbody>
</table>`;

// Pillars
const pillars = document.getElementById('pillars');
for (const pillar of roadmap.pillars) {
  const items = pillar.resources.map((id) => byId.get(id)).filter(Boolean);
  const done = items.filter((r) => doneResources.has(r.id)).length;
  const details = el(`<details>
    <summary>${esc(pillar.name)} <span class="count">${done}/${items.length} resources done</span></summary>
    <p>${esc(pillar.plan)}</p>
    <ul>${items.map((r) => `<li class="${doneResources.has(r.id) ? 'muted' : ''}"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a> <span class="muted">· ${esc(r.kind)} · ${esc(r.cost)} · ~${esc(r.hours)} h</span></li>`).join('')}</ul>
    <p><a href="resources.html?pillar=${encodeURIComponent(pillar.id)}">Open this pillar in Resources →</a></p>
  </details>`);
  pillars.append(details);
}

// Flagship
const flagship = document.getElementById('flagship');
for (const f of roadmap.flagship) {
  const items = f.resources.map((id) => byId.get(id)).filter(Boolean);
  flagship.append(el(`<div class="card">
    <h3>${esc(f.name)}</h3>
    <p class="why">${esc(f.text)}</p>
    <div class="meta">${items.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title.split(' (')[0].split(':')[0])}</a>`).join(' · ')}</div>
  </div>`));
}

// Week
document.getElementById('week').innerHTML = `<table>
  <thead><tr><th>Day</th><th>Hours</th><th>Block</th></tr></thead>
  <tbody>${roadmap.week.map((w) => `<tr><td>${esc(w.day)}</td><td>${w.hours}</td><td>${esc(w.block)}</td></tr>`).join('')}</tbody>
</table>`;

// Export / import / reset
document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `frontier-prep-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
document.getElementById('import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (confirm('Merge this export into your saved progress?')) {
      importAll(payload);
      location.reload();
    }
  } catch (error) {
    alert(`Could not import: ${error.message}`);
  }
});
document.getElementById('reset').addEventListener('click', () => {
  if (confirm('Clear every checkbox, practice session and note saved in this browser? The theme is kept.')) {
    resetAll();
    location.reload();
  }
});
