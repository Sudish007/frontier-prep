#!/usr/bin/env node
// Checks every URL in content/*.json (resources, questions, roadmap, companies) and writes
// docs/check-links-report.json. A 403/429/anti-bot answer is reported, never failed; only
// 404/410 and DNS failures count as broken. Flags: --timeout <ms>, --concurrency <n>, --fail
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, errorClass } from '../src/http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : [])).filter((e) => e.length));
const timeoutMs = Number(args.timeout || 12_000);
const concurrency = Number(args.concurrency || 6);

const files = ['resources.json', 'questions.json', 'roadmap.json', 'companies.json'];
const urls = new Map();
for (const name of files) {
  const text = await readFile(path.join(root, 'content', name), 'utf8');
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
    const url = match[0].replace(/[.,;]+$/, '');
    if (!urls.has(url)) urls.set(url, name);
  }
}

const list = [...urls.keys()];
console.log(`checking ${list.length} links with ${concurrency} workers`);
const results = [];
let index = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (index < list.length) {
      const url = list[index];
      index += 1;
      results.push(await check(url, urls.get(url)));
    }
  }),
);

async function check(url, file) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const { status } = await fetchText(url, { method, timeoutMs, retries: 0, headers: { accept: 'text/html,*/*;q=0.8' } });
      return { url, file, status, ok: true, verdict: 'ok' };
    } catch (error) {
      const status = error.status || 0;
      if (method === 'HEAD' && (status === 405 || status === 403 || status === 404 || status === 0)) continue;
      return { url, file, status, ok: false, verdict: verdictFor(error), error: errorClass(error) };
    }
  }
  return { url, file, status: 0, ok: false, verdict: 'other', error: 'unreachable' };
}

function verdictFor(error) {
  const status = error.status || 0;
  if (status === 404 || status === 410) return 'broken';
  if (status === 403 || status === 429 || status === 401) return 'blocked';
  if (/dns/.test(errorClass(error))) return 'broken';
  if (status >= 500) return 'server-error';
  return 'other';
}

const summary = { checked: results.length, ok: 0, blocked: 0, broken: 0, 'server-error': 0, other: 0 };
for (const r of results) summary[r.verdict] = (summary[r.verdict] || 0) + 1;
results.sort((a, b) => a.url.localeCompare(b.url));
await mkdir(path.join(root, 'docs'), { recursive: true });
await writeFile(path.join(root, 'docs', 'check-links-report.json'), `${JSON.stringify({ checkedAt: new Date().toISOString(), summary, results }, null, 2)}\n`);
console.log(summary);
for (const r of results.filter((x) => x.verdict === 'broken')) console.log(`  broken: ${r.url} (${r.file}) ${r.error}`);
if (args.fail && summary.broken > 0) process.exit(1);
