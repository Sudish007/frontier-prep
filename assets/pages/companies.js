import { mountChrome, loadContent, loadData, tracker, esc, el, hostOf, relativeDays } from '../app.js';

mountChrome('companies', { title: 'Companies' });

const [data, resources, questions, jobs] = await Promise.all([
  loadContent('companies.json'),
  loadContent('resources.json'),
  loadContent('questions.json'),
  loadData('jobs.json').catch(() => ({ items: [] })),
]);
const byId = new Map(resources.items.map((r) => [r.id, r]));
const doneResources = tracker('resources');

const jump = document.getElementById('jump');
const root = document.getElementById('companies');
for (const c of data.items) {
  jump.append(el(`<a class="chip company" href="#${esc(c.id)}" style="background:${esc(c.color)};min-height:36px">${esc(c.name)}</a>`));
  const qCount = questions.items.filter((q) => q.company === c.id).length;
  const reported = questions.items.filter((q) => q.company === c.id && q.tag === 'R').length;
  const companyJobs = jobs.items.filter((j) => j.company.toLowerCase().startsWith(c.id === 'google' ? 'google' : c.id)).filter((j) => j.india).slice(0, 5);
  const section = el(`<section id="${esc(c.id)}" class="panel" style="margin:1.5rem 0;border-top:4px solid ${esc(c.color)}">
    <h2 style="margin-top:0">${esc(c.name)}</h2>
    <p>${esc(c.india)}</p>
    <div class="grid">
      <div>
        <h3>Roles to watch in India</h3>
        <ul>${c.rolesIndia.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <p><a href="${esc(c.careersUrl)}" target="_blank" rel="noopener">Careers page →</a> · <a href="questions.html?company=${esc(c.id)}">${qCount} questions (${reported} reported) →</a> · <a href="resources.html?company=${esc(c.id)}">Resources →</a></p>
      </div>
      <div>
        <h3>What fails people</h3>
        <p>${esc(c.failsPeople)}</p>
        <h3>AI-usage policy</h3>
        <p>${esc(c.aiPolicy)}</p>
      </div>
    </div>
    <h3>The loop</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Stage</th><th>What to expect</th></tr></thead>
      <tbody>${c.loop.map((s) => `<tr><td><strong>${esc(s.stage)}</strong></td><td>${esc(s.note)}</td></tr>`).join('')}</tbody>
    </table></div>
    <h3>Values and principles they score against</h3>
    <ul>${c.values.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>
    <h3>Read first</h3>
    <ul>${c.readFirst.map((id) => byId.get(id)).filter(Boolean).map((r) => `<li class="${doneResources.has(r.id) ? 'muted' : ''}"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a> <span class="muted">· ~${esc(r.hours)} h</span></li>`).join('')}</ul>
    ${companyJobs.length ? `<h3>Open roles in India matching the watch list</h3><ul>${companyJobs.map((j) => `<li><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a> <span class="muted">· ${esc(j.location)} · ${esc(relativeDays(j.postedAt || j.firstSeen))}</span></li>`).join('')}</ul>` : ''}
    <p class="muted">Sources: ${c.sources.map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(hostOf(s))}</a>`).join(' · ')}</p>
  </section>`);
  root.append(section);
}
