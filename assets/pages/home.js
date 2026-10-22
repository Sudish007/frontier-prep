import { mountChrome, loadContent, loadData, tracker, practiceLog, esc, el, formatDate, relativeDays, daysUntil, companyChip, hostOf } from '../app.js';

mountChrome('home', { title: 'Home' });

const [resources, questions, roadmap, feed, jobs, meta] = await Promise.all([
  loadContent('resources.json'),
  loadContent('questions.json'),
  loadContent('roadmap.json'),
  loadData('feed.json').catch(() => ({ items: [] })),
  loadData('jobs.json').catch(() => ({ items: [] })),
  loadData('meta.json').catch(() => null),
]);

const doneResources = tracker('resources');
const doneQuestions = tracker('questions');
const doneTasks = tracker('tasks');
const log = practiceLog();
const counts = log.counts();

// Stats
const indiaJobs = jobs.items.filter((j) => j.india).length;
document.getElementById('stats').innerHTML = [
  [resources.items.length, 'curated resources'],
  [questions.items.length, 'interview questions'],
  [feed.items.length, `feed items (${roadmap ? meta?.windowDays || 45 : 45}-day window)`],
  [indiaJobs, 'matching roles in India'],
  [meta ? formatDate(meta.generatedAt) : '—', 'data generated', 'small'],
].map(([n, label, cls]) => `<div class="stat ${cls || ''}"><b>${esc(n)}</b><span>${esc(label)}</span></div>`).join('');

// Progress cards
const totalTasks = roadmap.phases.reduce((a, p) => a + p.tasks.length, 0);
const nextCheckpoint = roadmap.checkpoints.find((c) => daysUntil(c.date) >= 0) || roadmap.checkpoints.at(-1);
const p1Resources = resources.items.filter((r) => r.priority === 1);
const p1Done = p1Resources.filter((r) => doneResources.has(r.id)).length;
const progress = document.getElementById('progress');
progress.append(
  progressCard('Roadmap tasks', doneTasks.count(), totalTasks, 'roadmap.html'),
  progressCard('Priority-one resources', p1Done, p1Resources.length, 'resources.html?priority=1'),
  progressCard('Questions practiced', doneQuestions.count(), questions.items.length, 'questions.html'),
  checkpointCard(nextCheckpoint, counts),
);

function progressCard(label, done, total, href) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return el(`<a class="card" href="${href}" style="text-decoration:none;color:inherit">
    <h3>${esc(label)}</h3>
    <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}"><span style="width:${pct}%"></span></div>
    <div class="meta"><span>${done} of ${total}</span><span>·</span><span>${pct}%</span></div>
  </a>`);
}

function checkpointCard(cp, c) {
  const days = daysUntil(cp.date);
  const rows = Object.entries(cp.metrics || {}).map(([k, target]) => {
    const have = { sessions: c.coding, designs: c.design, prs: c.pr, mocks: c.mock, chats: c.chat }[k] ?? 0;
    const pct = Math.min(100, Math.round((have / target) * 100));
    return `<div class="progress-row"><div class="progress" aria-label="${esc(k)}"><span style="width:${pct}%"></span></div><span class="count">${esc(k)} ${have}/${target}</span></div>`;
  }).join('');
  return el(`<div class="card">
    <h3>Next checkpoint · ${formatDate(cp.date)} <span class="chip ${days < 14 ? 'warn' : 'plain'}">${days >= 0 ? `${days} days` : 'passed'}</span></h3>
    <p class="why">${esc(cp.must)}</p>
    ${rows}
    <div class="meta"><a href="practice.html">Log a session →</a></div>
  </div>`);
}

// This week
const week = document.getElementById('week');
const dayIndex = new Date().getDay(); // 0 Sunday
const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = names[dayIndex];
const currentPhase = roadmap.phases.find((p) => daysUntil(p.from) <= 0 && daysUntil(p.to) >= 0) || roadmap.phases[0];
const openTasks = currentPhase.tasks.filter((t) => !doneTasks.has(t.id)).slice(0, 3);
week.innerHTML = `
  <p><strong>${esc(currentPhase.name)}</strong> <span class="muted">(${formatDate(currentPhase.from)} → ${formatDate(currentPhase.to)})</span><br>${esc(currentPhase.goal)}</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Day</th><th>Hours</th><th>Block</th></tr></thead>
    <tbody>${roadmap.week.map((w) => `<tr ${w.day === today ? 'style="background:var(--chip)"' : ''}><td>${esc(w.day)}${w.day === today ? ' <span class="chip">today</span>' : ''}</td><td>${w.hours}</td><td>${esc(w.block)}</td></tr>`).join('')}</tbody>
  </table></div>
  ${openTasks.length ? `<h3>Open tasks in this phase</h3><ul>${openTasks.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ul><p><a href="roadmap.html">All phases and checkpoints →</a></p>` : '<p class="muted">All tasks in this phase are checked off.</p>'}
`;

// Start here
const startHere = document.getElementById('start-here');
const pending = p1Resources.filter((r) => !doneResources.has(r.id)).slice(0, 6);
if (!pending.length) startHere.innerHTML = '<div class="empty">Every priority-one resource is marked done. Move to priority two on the Resources page.</div>';
for (const r of pending) {
  startHere.append(el(`<div class="card">
    <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></h3>
    <div class="meta"><span class="chip plain">${esc(r.kind)}</span><span class="chip plain">${esc(r.cost)}</span><span>${esc(r.hours)} h</span><span>${esc(hostOf(r.url))}</span></div>
    <p class="why">${esc(r.why)}</p>
  </div>`));
}

// Latest feed
const latest = document.getElementById('latest');
const latestItems = feed.items.slice(0, 8);
if (!latestItems.length) latest.innerHTML = '<div class="empty">No feed data yet. Run <code>npm run fetch</code> or wait for the scheduled refresh.</div>';
for (const item of latestItems) {
  latest.append(el(`<article class="item">
    <a class="title" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>
    <div class="meta"><span>${esc(item.sourceName)}</span><span>·</span><span>${esc(relativeDays(item.publishedAt || item.firstSeen))}</span>${item.topics.map((t) => `<span class="chip plain">${esc(t)}</span>`).join('')}</div>
  </article>`));
}

// Jobs
const jobsEl = document.getElementById('jobs');
const topJobs = jobs.items.filter((j) => j.india || j.remote).slice(0, 8);
if (!topJobs.length) jobsEl.innerHTML = '<div class="empty">No matching roles in the current data. The Jobs page lists every board and its status.</div>';
for (const j of topJobs) {
  jobsEl.append(el(`<article class="item">
    <a class="title" href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>
    <div class="meta">${companyChip(j.company.toLowerCase().split(' ')[0])}<span>${esc(j.location)}</span><span>·</span><span>${esc(relativeDays(j.postedAt || j.firstSeen))}</span></div>
  </article>`));
}
