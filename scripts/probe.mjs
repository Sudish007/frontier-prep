#!/usr/bin/env node
// Probe candidate URLs from this machine (or a runner): status, size, and a sample of hrefs.
// Usage: node scripts/probe.mjs <url> [<url> ...]   or   node scripts/probe.mjs --jobs
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
if (args[0] === '--jobs') {
  const jobs = JSON.parse(await readFile(new URL('../data/jobs.json', import.meta.url), 'utf8')).items;
  console.log('india matches:');
  for (const j of jobs.filter((j) => j.india)) console.log(`  ${j.company} | ${j.title} | ${j.location}`);
  const byCompany = {};
  for (const j of jobs) (byCompany[j.company] ||= new Set()).add(j.location);
  for (const [c, s] of Object.entries(byCompany)) console.log(`${c}: ${[...s].slice(0, 15).join(' ; ')}`);
  process.exit(0);
}
for (const url of args) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (probe)' }, redirect: 'follow' });
    const text = await r.text();
    const hrefs = [...text.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => /engineering|blog|channel/i.test(h)).slice(0, 8);
    console.log(r.status, url, `${text.length} bytes`, r.headers.get('content-type') || '');
    if (hrefs.length) console.log('   ', hrefs.join('\n    '));
    const channel = text.match(/"channelId":"([^"]+)"/) || text.match(/channel_id=([A-Za-z0-9_-]+)/);
    if (channel) console.log('    channelId', channel[1]);
  } catch (error) {
    console.log('ERR', url, error.code || error.message, error.cause?.code || error.cause?.message || '');
  }
}
