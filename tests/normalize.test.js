import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, idFor, dedupe, sortNewest, clipText, normalizeItem } from '../src/normalize.js';

test('canonicalUrl strips tracking params, hashes, trailing slashes and normalizes arXiv/YouTube', () => {
  assert.equal(canonicalUrl('https://Example.com/a/?utm_source=x&ref=y&keep=1#top'), 'https://example.com/a?keep=1');
  assert.equal(canonicalUrl('https://www.youtube.com/watch?v=abc&feature=share&t=10'), 'https://www.youtube.com/watch?v=abc');
  assert.equal(canonicalUrl('http://export.arxiv.org/abs/2301.00001v2'), 'http://arxiv.org/abs/2301.00001');
  assert.equal(canonicalUrl('https://arxiv.org/pdf/2301.00001.pdf'), 'https://arxiv.org/abs/2301.00001');
  assert.equal(canonicalUrl('not a url'), 'not a url');
});

test('idFor is stable across tracking variants', () => {
  assert.equal(idFor('https://example.com/a?utm_source=x'), idFor('https://example.com/a/'));
  assert.equal(idFor('https://example.com/a').length, 16);
});

test('dedupe keeps the earliest firstSeen and fills missing dates and summaries', () => {
  const merged = dedupe([
    { id: '1', publishedAt: null, firstSeen: '2026-10-02T00:00:00.000Z', summary: '' },
    { id: '1', publishedAt: '2026-10-01T00:00:00.000Z', firstSeen: '2026-10-01T00:00:00.000Z', summary: 'S' },
    { id: '2', publishedAt: null, firstSeen: '2026-10-03T00:00:00.000Z' },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].publishedAt, '2026-10-01T00:00:00.000Z');
  assert.equal(merged[0].firstSeen, '2026-10-01T00:00:00.000Z');
  assert.equal(merged[0].summary, 'S');
});

test('sortNewest orders by publishedAt or firstSeen descending with stable tiebreak', () => {
  const sorted = sortNewest([
    { id: 'b', publishedAt: '2026-10-01T00:00:00.000Z', firstSeen: '2026-10-05T00:00:00.000Z' },
    { id: 'a', publishedAt: null, firstSeen: '2026-10-04T00:00:00.000Z' },
    { id: 'c', publishedAt: '2026-10-04T00:00:00.000Z', firstSeen: '2026-10-05T00:00:00.000Z' },
  ]);
  assert.deepEqual(sorted.map((i) => i.id), ['a', 'c', 'b']);
});

test('clipText strips html and clips on a word boundary with an ellipsis', () => {
  const text = clipText(`<p>${'word '.repeat(100)}</p>`, 50);
  assert.ok(text.length <= 51);
  assert.ok(text.endsWith('…'));
  assert.ok(!text.includes('<'));
});

test('normalizeItem builds the data/feed.json item shape', () => {
  const item = normalizeItem({ title: ' <b>Hi</b> ', url: 'https://example.com/x/?utm_medium=m', publishedAt: null, summary: '' }, { id: 's', name: 'Source', class: 'rss', topics: ['t'] }, '2026-10-22T00:00:00.000Z');
  assert.deepEqual(Object.keys(item).sort(), ['class', 'firstSeen', 'id', 'publishedAt', 'source', 'sourceName', 'summary', 'title', 'topics', 'url']);
  assert.equal(item.title, 'Hi');
  assert.equal(item.url, 'https://example.com/x');
});
