import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runPipeline } from '../src/pipeline.js';

const RSS = (title, url, date) => `<?xml version="1.0"?><rss version="2.0"><channel><item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description>A tutorial on evals</description></item></channel></rss>`;

function fakeFetch(routes) {
  return async (url) => {
    const route = routes[url];
    if (!route) return { ok: false, status: 404, text: async () => 'not found', headers: new Headers(), url };
    if (route instanceof Error) throw route;
    if (route.status && route.status >= 400) return { ok: false, status: route.status, text: async () => route.body || '', headers: new Headers(), url };
    return { ok: true, status: 200, text: async () => route.body, headers: new Headers({ 'content-type': route.type || 'application/xml' }), url };
  };
}

const sources = [
  { id: 'good', name: 'Good', class: 'rss', kind: 'lab', url: 'https://good/feed', topics: ['t'] },
  { id: 'bad', name: 'Bad', class: 'rss', kind: 'lab', url: 'https://bad/feed', topics: ['t'] },
  { id: 'links', name: 'Links', class: 'html-links', kind: 'lab', url: 'https://links/news', include: /^\/news\/[a-z-]+$/, topics: ['t'] },
];
const jobBoards = [
  { id: 'gh', company: 'Anthropic', kind: 'greenhouse', slug: 'anthropic', url: 'https://x' },
  { id: 'manual', company: 'Google', kind: 'manual', url: 'https://g' },
];

test('pipeline writes feed, discovered, jobs and meta; failed sources keep previous items', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fp-'));
  try {
    const now = new Date('2026-10-22T00:00:00Z');
    const routes = {
      'https://good/feed': { body: RSS('New course on evals', 'https://good/a?utm_source=x', 'Tue, 21 Oct 2026 00:00:00 GMT') },
      'https://bad/feed': { body: RSS('Old post', 'https://bad/old', 'Mon, 20 Oct 2026 00:00:00 GMT') },
      'https://links/news': { body: '<a href="/news/first-interview-report">First interview report here</a>', type: 'text/html' },
      'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs': { body: JSON.stringify({ jobs: [{ id: 1, title: 'Applied AI Engineer', location: { name: 'Bengaluru, India' }, absolute_url: 'https://j/1', updated_at: '2026-10-20T00:00:00Z' }, { id: 2, title: 'Account Executive', location: { name: 'London' }, absolute_url: 'https://j/2' }] }), type: 'application/json' },
    };
    const first = await runPipeline({ sources, jobBoards, dataDir: dir, now, fetchImpl: fakeFetch(routes), log: () => {} });
    assert.equal(first.items.length, 3);
    assert.equal(first.meta.counts.sources.ok, 3);
    assert.equal(first.jobs.length, 1);
    assert.equal(first.jobs[0].india, true);
    assert.ok(first.discovered.some((d) => d.kind === 'course'));
    assert.ok(first.discovered.some((d) => d.kind === 'interview'));
    const feed = JSON.parse(await readFile(path.join(dir, 'feed.json'), 'utf8'));
    assert.equal(feed.items.find((i) => i.source === 'good').url, 'https://good/a', 'tracking params stripped');
    assert.equal(feed.items[0].source, 'links', 'undated items sort by firstSeen, which is newest here');
    const link = feed.items.find((i) => i.source === 'links');
    assert.equal(link.publishedAt, null);
    assert.equal(link.firstSeen, now.toISOString());

    // Second run: 'bad' fails, greenhouse fails; previous items and jobs must survive, firstSeen preserved.
    const later = new Date('2026-10-23T00:00:00Z');
    routes['https://bad/feed'] = { status: 503, body: 'down' };
    routes['https://boards-api.greenhouse.io/v1/boards/anthropic/jobs'] = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
    const second = await runPipeline({ sources, jobBoards, dataDir: dir, now: later, fetchImpl: fakeFetch(routes), log: () => {} });
    assert.equal(second.items.length, 3);
    const badStatus = second.meta.sources.find((s) => s.id === 'bad');
    assert.equal(badStatus.status, 'failed');
    assert.equal(badStatus.error, 'http: 503');
    assert.equal(badStatus.failingSince, later.toISOString());
    assert.equal(second.jobs.length, 1, 'jobs survive a failed board');
    assert.equal(second.meta.jobBoards.find((b) => b.id === 'gh').error, 'dns: ENOTFOUND');
    assert.equal(second.meta.jobBoards.find((b) => b.id === 'manual').status, 'manual');
    const link2 = second.items.find((i) => i.source === 'links');
    assert.equal(link2.firstSeen, now.toISOString(), 'firstSeen preserved across runs');

    // Window: items older than windowDays drop out.
    const far = new Date('2027-01-01T00:00:00Z');
    const third = await runPipeline({ sources, jobBoards: [], dataDir: dir, now: far, fetchImpl: fakeFetch(routes), windowDays: 45, log: () => {} });
    assert.equal(third.items.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dry run writes nothing and --source filtering marks others skipped', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fp-'));
  try {
    await writeFile(path.join(dir, 'meta.json'), JSON.stringify({ sources: [{ id: 'bad', status: 'ok' }] }));
    const result = await runPipeline({ sources, jobBoards: [], dataDir: dir, now: new Date('2026-10-22T00:00:00Z'), fetchImpl: fakeFetch({ 'https://good/feed': { body: RSS('x', 'https://good/x', 'Tue, 21 Oct 2026 00:00:00 GMT') } }), dryRun: true, onlySources: ['good'], log: () => {} });
    assert.equal(result.meta.sources.find((s) => s.id === 'good').status, 'ok');
    assert.equal(result.meta.sources.find((s) => s.id === 'bad').status, 'ok', 'previous status carried when skipped');
    assert.equal(result.meta.sources.find((s) => s.id === 'links').status, 'skipped');
    await assert.rejects(readFile(path.join(dir, 'feed.json')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
