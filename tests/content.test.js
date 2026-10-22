import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sources, jobBoards } from '../sources.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (name) => JSON.parse(await readFile(path.join(root, 'content', name), 'utf8'));

const PILLARS = ['coding', 'design', 'ml', 'llm', 'apps', 'evals', 'safety', 'behavioral', 'career', 'projects'];
const KINDS = ['course', 'video', 'book', 'paper', 'docs', 'blog', 'practice', 'community', 'tool', 'official', 'repo'];
const COMPANIES = ['anthropic', 'openai', 'google', 'microsoft', 'amazon', 'all'];

test('resources.json: unique ids, valid enums, https urls, hours and priority', async () => {
  const data = await read('resources.json');
  assert.deepEqual(data.pillars.map((p) => p.id), PILLARS);
  const ids = new Set();
  for (const r of data.items) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.match(r.url, /^https:\/\//, r.id);
    assert.ok(PILLARS.includes(r.pillar), `${r.id} pillar`);
    assert.ok(KINDS.includes(r.kind), `${r.id} kind ${r.kind}`);
    assert.ok(['free', 'freemium', 'paid'].includes(r.cost), `${r.id} cost`);
    assert.ok(['beginner', 'intermediate', 'advanced'].includes(r.level), `${r.id} level`);
    assert.ok([1, 2, 3].includes(r.priority), `${r.id} priority`);
    assert.ok(typeof r.hours === 'number' && r.hours > 0, `${r.id} hours`);
    assert.ok(r.companies.length > 0 && r.companies.every((c) => COMPANIES.includes(c)), `${r.id} companies`);
    assert.ok(r.why.length > 20, `${r.id} why`);
  }
  assert.ok(data.items.length >= 120);
  assert.ok(data.items.filter((r) => r.priority === 1).length >= 25, 'enough priority-one items');
});

test('questions.json: tags, rounds, companies and sources resolve', async () => {
  const data = await read('questions.json');
  const rounds = new Set(data.rounds.map((r) => r.id));
  for (const q of data.items) {
    assert.ok(['R', 'O', 'S'].includes(q.tag), q.q);
    assert.ok(rounds.has(q.round), `${q.round}: ${q.q}`);
    assert.ok(COMPANIES.includes(q.company), q.q);
    assert.ok(data.sources[q.source], `missing source ${q.source}`);
    assert.ok(q.q.length > 10, q.q);
  }
  for (const url of Object.values(data.sources)) assert.match(url, /^https:\/\//);
  assert.ok(data.items.length >= 200);
  assert.ok(data.items.filter((q) => q.tag === 'R').length >= 150, 'mostly reported questions');
});

test('roadmap.json and companies.json reference existing resources and have consistent dates', async () => {
  const [roadmap, companies, resources] = await Promise.all([read('roadmap.json'), read('companies.json'), read('resources.json')]);
  const ids = new Set(resources.items.map((r) => r.id));
  for (const p of roadmap.pillars) for (const id of p.resources) assert.ok(ids.has(id), `pillar ${p.id} -> ${id}`);
  for (const f of roadmap.flagship) for (const id of f.resources) assert.ok(ids.has(id), `flagship ${f.id} -> ${id}`);
  for (const c of companies.items) for (const id of c.readFirst) assert.ok(ids.has(id), `company ${c.id} -> ${id}`);
  const taskIds = new Set();
  for (const phase of roadmap.phases) {
    assert.ok(phase.from < phase.to, phase.id);
    for (const t of phase.tasks) {
      assert.ok(!taskIds.has(t.id), `duplicate task ${t.id}`);
      taskIds.add(t.id);
    }
  }
  const dates = roadmap.checkpoints.map((c) => c.date);
  assert.deepEqual(dates, [...dates].sort(), 'checkpoints chronological');
  assert.equal(roadmap.shapes.length, 12);
  assert.equal(companies.items.length, 5);
  for (const c of companies.items) assert.match(c.careersUrl, /^https:\/\//);
});

test('sources.config.mjs: unique ids, parsers and job board kinds are known', () => {
  const ids = new Set();
  for (const s of sources) {
    assert.ok(!ids.has(s.id), `duplicate source ${s.id}`);
    ids.add(s.id);
    assert.ok(['rss', 'atom', 'html-links'].includes(s.class), s.id);
    assert.match(s.url, /^https:\/\//, s.id);
    if (s.class === 'html-links') assert.ok(s.include instanceof RegExp, `${s.id} include`);
    assert.ok(Array.isArray(s.topics) && s.topics.length, `${s.id} topics`);
  }
  for (const b of jobBoards) assert.ok(['greenhouse', 'ashby', 'amazon', 'microsoft', 'manual'].includes(b.kind), b.id);
});

test('every html page links the shared stylesheet and a page module that exists', async () => {
  const pages = (await readdir(root)).filter((f) => f.endsWith('.html') && f !== '404.html');
  assert.ok(pages.length >= 8);
  for (const page of pages) {
    const html = await readFile(path.join(root, page), 'utf8');
    assert.match(html, /<html lang="en">/, page);
    assert.match(html, /assets\/app\.css/, page);
    const mod = html.match(/assets\/pages\/([a-z]+)\.js/);
    assert.ok(mod, `${page} has no page module`);
    await readFile(path.join(root, 'assets', 'pages', `${mod[1]}.js`));
  }
});
