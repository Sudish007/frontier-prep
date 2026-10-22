// Canonical URLs, stable ids, and the item shape written to data/feed.json.

import { createHash } from 'node:crypto';
import { decodeEntities } from './parsers.js';

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|source$|igshid$|si$|feature$)/i;

export function canonicalUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return String(input || '').trim();
  }
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  if (url.hostname === 'www.youtube.com' && url.pathname === '/watch') {
    const v = url.searchParams.get('v');
    if (v) return `https://www.youtube.com/watch?v=${v}`;
  }
  if (url.hostname.endsWith('arxiv.org')) {
    url.hostname = 'arxiv.org';
    url.pathname = url.pathname.replace(/^\/pdf\//, '/abs/').replace(/v\d+$/, '').replace(/\.pdf$/, '');
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
  if (url.search === '?') url.search = '';
  return url.toString();
}

export function idFor(url) {
  return createHash('sha1').update(canonicalUrl(url)).digest('hex').slice(0, 16);
}

export function stripHtml(text) {
  return decodeEntities(String(text || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function clipText(text, max = 280) {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trim()}…`;
}

export function normalizeItem(raw, source, nowIso) {
  const url = canonicalUrl(raw.url);
  return {
    id: idFor(url),
    url,
    title: stripHtml(raw.title).slice(0, 220),
    summary: clipText(raw.summary || ''),
    publishedAt: raw.publishedAt || null,
    firstSeen: nowIso,
    source: source.id,
    sourceName: source.name,
    class: source.class,
    topics: source.topics || [],
  };
}

// Deduplicates by id. When two sources yield the same URL, keep the one with a date,
// and the earliest firstSeen.
export function dedupe(items) {
  const byId = new Map();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    const merged = { ...existing };
    if (!merged.publishedAt && item.publishedAt) merged.publishedAt = item.publishedAt;
    if (item.firstSeen < merged.firstSeen) merged.firstSeen = item.firstSeen;
    if (!merged.summary && item.summary) merged.summary = item.summary;
    byId.set(item.id, merged);
  }
  return [...byId.values()];
}

export function sortNewest(items) {
  return [...items].sort((a, b) => {
    const da = a.publishedAt || a.firstSeen;
    const db = b.publishedAt || b.firstSeen;
    if (da !== db) return da < db ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
