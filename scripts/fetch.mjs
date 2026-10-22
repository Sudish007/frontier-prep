#!/usr/bin/env node
// Refreshes data/*.json. Flags: --dry-run, --data-dir <dir>, --now <iso>, --source a,b,c
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../src/pipeline.js';
import { sources, jobBoards } from '../sources.config.mjs';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(root, args['data-dir'] || 'data');
const now = args.now ? new Date(args.now) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`invalid --now: ${args.now}`);
  process.exit(2);
}
const onlySources = args.source ? String(args.source).split(',').map((s) => s.trim()).filter(Boolean) : null;

const overall = setTimeout(() => {
  console.error('run exceeded 10 minutes; aborting');
  process.exit(3);
}, 10 * 60_000);

const started = Date.now();
const { meta } = await runPipeline({
  sources,
  jobBoards: onlySources ? [] : jobBoards,
  dataDir,
  now,
  dryRun: Boolean(args['dry-run']),
  onlySources,
  log: (line) => console.log(line),
});
clearTimeout(overall);

const s = meta.counts.sources;
console.log(
  `\n${args['dry-run'] ? '[dry run] ' : ''}items ${meta.counts.items}, discovered ${meta.counts.discovered}, jobs ${meta.counts.jobs} (${meta.counts.jobsIndia} India); sources ok ${s.ok || 0}, empty ${s.empty || 0}, failed ${s.failed || 0}, skipped ${s.skipped || 0}; ${Math.round((Date.now() - started) / 1000)} s`,
);
for (const source of meta.sources) {
  if (source.status === 'failed') console.log(`  failed: ${source.id} ${source.error}`);
}
for (const board of meta.jobBoards) {
  if (board.status === 'failed') console.log(`  failed jobs: ${board.id} ${board.error}`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}
