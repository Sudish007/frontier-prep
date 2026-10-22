// Orchestrates one refresh: fetch every registry source and job board, normalize,
// dedupe, window, merge with the previous data, classify resource candidates, and write
// data/feed.json, data/jobs.json, data/discovered.json and data/meta.json.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchText, errorClass } from './http.js';
import { parseFeed, parseHtmlLinks } from './parsers.js';
import { normalizeItem, dedupe, sortNewest } from './normalize.js';
import { classifyResource } from './discover.js';
import { fetchBoard } from './jobs.js';

export async function runPipeline(options) {
  const {
    sources,
    jobBoards = [],
    dataDir,
    now = new Date(),
    fetchImpl = globalThis.fetch,
    concurrency = 4,
    perSourceTimeoutMs = 45_000,
    windowDays = 45,
    jobWindowDays = 60,
    dryRun = false,
    onlySources = null,
    log = () => {},
  } = options;

  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - windowDays * 86_400_000).toISOString();
  const jobCutoff = new Date(now.getTime() - jobWindowDays * 86_400_000).toISOString();

  const previousFeed = await readJson(path.join(dataDir, 'feed.json'));
  const previousJobs = await readJson(path.join(dataDir, 'jobs.json'));
  const previousMeta = await readJson(path.join(dataDir, 'meta.json'));
  const previousById = new Map((previousFeed?.items || []).map((item) => [item.id, item]));
  const previousJobsById = new Map((previousJobs?.items || []).map((job) => [job.id, job]));
  const previousStatus = new Map((previousMeta?.sources || []).map((s) => [s.id, s]));

  const selected = onlySources ? sources.filter((s) => onlySources.includes(s.id)) : sources;

  const sourceResults = await runPool(selected, concurrency, async (source) => {
    const started = Date.now();
    try {
      const items = await fetchSource(source, { fetchImpl, timeoutMs: perSourceTimeoutMs });
      log(`ok     ${source.id} (${items.length} items, ${Date.now() - started} ms)`);
      return { source, status: items.length ? 'ok' : 'empty', items, error: null };
    } catch (error) {
      const cls = errorClass(error);
      log(`failed ${source.id}: ${cls}`);
      return { source, status: 'failed', items: [], error: cls };
    }
  });

  // Normalize, preserve firstSeen from the previous run, dedupe, window, sort.
  let items = [];
  for (const result of sourceResults) {
    for (const raw of result.items) {
      const item = normalizeItem(raw, result.source, nowIso);
      const previous = previousById.get(item.id);
      if (previous?.firstSeen) item.firstSeen = previous.firstSeen;
      if (!item.publishedAt && previous?.publishedAt) item.publishedAt = previous.publishedAt;
      items.push(item);
    }
  }
  // Items from sources that were not fetched this run (filtered or failed) survive from
  // the previous feed so a dark runner never empties the page.
  const fetchedOk = new Set(sourceResults.filter((r) => r.status !== 'failed').map((r) => r.source.id));
  for (const previous of previousById.values()) {
    if (!fetchedOk.has(previous.source)) items.push(previous);
  }
  items = sortNewest(dedupe(items)).filter((item) => (item.publishedAt || item.firstSeen) >= cutoff);

  const discovered = items.map(classifyResource).filter(Boolean);

  // Jobs.
  const boardResults = await runPool(jobBoards.filter((b) => b.kind !== 'manual'), concurrency, async (board) => {
    try {
      const jobs = await fetchBoard(board, { fetchImpl, timeoutMs: perSourceTimeoutMs });
      log(`ok     jobs:${board.id} (${jobs.length} matching)`);
      return { board, status: jobs.length ? 'ok' : 'empty', jobs, error: null };
    } catch (error) {
      const cls = errorClass(error);
      log(`failed jobs:${board.id}: ${cls}`);
      return { board, status: 'failed', jobs: [], error: cls };
    }
  });
  let jobs = [];
  const boardsOk = new Set(boardResults.filter((r) => r.status !== 'failed').map((r) => r.board.id));
  for (const result of boardResults) {
    for (const job of result.jobs) {
      const previous = previousJobsById.get(job.id);
      jobs.push({ ...job, firstSeen: previous?.firstSeen || nowIso });
    }
  }
  for (const previous of previousJobsById.values()) {
    if (!boardsOk.has(previous.board)) jobs.push(previous);
  }
  const seenJobs = new Set();
  jobs = jobs
    .filter((job) => (seenJobs.has(job.id) ? false : (seenJobs.add(job.id), true)))
    .filter((job) => (job.postedAt || job.firstSeen) >= jobCutoff)
    .sort((a, b) => {
      const da = a.postedAt || a.firstSeen;
      const db = b.postedAt || b.firstSeen;
      return da === db ? a.id.localeCompare(b.id) : da < db ? 1 : -1;
    });

  const meta = {
    generatedAt: nowIso,
    windowDays,
    jobWindowDays,
    counts: {
      items: items.length,
      discovered: discovered.length,
      jobs: jobs.length,
      jobsIndia: jobs.filter((j) => j.india).length,
      sources: { ok: 0, empty: 0, failed: 0, skipped: 0 },
    },
    sources: sources.map((source) => {
      const result = sourceResults.find((r) => r.source.id === source.id);
      const sourceItems = items.filter((i) => i.source === source.id);
      const newest = sourceItems.length ? sourceItems[0].publishedAt || sourceItems[0].firstSeen : null;
      if (!result) {
        const previous = previousStatus.get(source.id);
        return { ...baseStatus(source), status: previous?.status || 'skipped', count: sourceItems.length, newest, error: previous?.error || null, fetchedAt: previous?.fetchedAt || null, failingSince: previous?.failingSince || null, note: source.note || null };
      }
      const previous = previousStatus.get(source.id);
      const failingSince = result.status === 'failed' ? previous?.failingSince || nowIso : null;
      return { ...baseStatus(source), status: result.status, count: sourceItems.length, newest, error: result.error, fetchedAt: nowIso, failingSince, note: source.note || null };
    }),
    jobBoards: jobBoards.map((board) => {
      const result = boardResults.find((r) => r.board.id === board.id);
      const count = jobs.filter((j) => j.board === board.id).length;
      if (board.kind === 'manual') return { id: board.id, company: board.company, kind: 'manual', status: 'manual', url: board.url, count: 0, error: null };
      return { id: board.id, company: board.company, kind: board.kind, status: result?.status || 'skipped', url: board.url || null, count, error: result?.error || null, fetchedAt: result ? nowIso : null };
    }),
  };
  for (const s of meta.sources) meta.counts.sources[s.status] = (meta.counts.sources[s.status] || 0) + 1;

  const files = {
    'feed.json': { generatedAt: nowIso, items },
    'discovered.json': { generatedAt: nowIso, items: discovered },
    'jobs.json': { generatedAt: nowIso, items: jobs },
    'meta.json': meta,
  };
  if (!dryRun) {
    await mkdir(dataDir, { recursive: true });
    for (const [name, value] of Object.entries(files)) {
      await writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);
    }
  }
  return { meta, items, jobs, discovered };
}

export async function fetchSource(source, { fetchImpl, timeoutMs }) {
  const { body } = await fetchText(source.url, { fetchImpl, timeoutMs, headers: source.headers || {} });
  let items;
  if (source.class === 'html-links') {
    items = parseHtmlLinks(body, { baseUrl: source.url, include: source.include, exclude: source.exclude || null });
  } else {
    items = parseFeed(body);
  }
  if (source.filter) items = items.filter((item) => source.filter.test(`${item.title} ${item.summary}`));
  if (source.limit) items = items.slice(0, source.limit);
  return items;
}

function baseStatus(source) {
  return { id: source.id, name: source.name, class: source.class, kind: source.kind || source.class, homepage: source.homepage || null };
}

async function runPool(inputs, size, worker) {
  const results = new Array(inputs.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, inputs.length) }, async () => {
    while (next < inputs.length) {
      const index = next;
      next += 1;
      results[index] = await worker(inputs[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}
