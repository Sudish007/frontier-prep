import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, parseHtmlLinks, decodeEntities } from '../src/parsers.js';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>First &amp; foremost</title><link>https://example.com/a?utm_source=x</link><pubDate>Mon, 20 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Hello <b>world</b></p>]]></description></item>
<item><title>No link</title><guid>https://example.com/b</guid></item>
<item><title></title><link>https://example.com/empty</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Entry one</title><link rel="alternate" href="https://example.com/one"/><link rel="self" href="https://example.com/self"/><published>2026-10-21T08:00:00Z</published><summary>S</summary></entry>
<entry><title>Entry two</title><id>https://example.com/two</id><updated>2026-10-19T08:00:00Z</updated></entry>
</feed>`;

const YT = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<entry><title>Video</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/><published>2026-10-21T08:00:00Z</published><media:group><media:description>Desc here</media:description></media:group></entry>
</feed>`;

test('parses RSS items with CDATA, entities and guid fallback', () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'First & foremost');
  assert.equal(items[0].url, 'https://example.com/a?utm_source=x');
  assert.equal(items[0].publishedAt, '2026-10-20T10:00:00.000Z');
  assert.match(items[0].summary, /Hello/);
  assert.equal(items[1].url, 'https://example.com/b');
  assert.equal(items[1].publishedAt, null);
});

test('parses Atom entries preferring the alternate link and published date', () => {
  const items = parseFeed(ATOM);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://example.com/one');
  assert.equal(items[0].publishedAt, '2026-10-21T08:00:00.000Z');
  assert.equal(items[1].url, 'https://example.com/two');
  assert.equal(items[1].publishedAt, '2026-10-19T08:00:00.000Z');
});

test('parses YouTube media descriptions', () => {
  const items = parseFeed(YT);
  assert.equal(items[0].summary, 'Desc here');
});

test('throws SyntaxError on non-feed xml and empty input returns []', () => {
  assert.throws(() => parseFeed('<html><body>nope</body></html>'), SyntaxError);
  assert.deepEqual(parseFeed(''), []);
});

test('extracts html links matching the include pattern and dedupes', () => {
  const html = `<a href="/news/first-post">First post title</a><a href="/news/first-post#x">First post title</a>
    <a href="https://www.anthropic.com/news/second-post"><span>Second</span> <b>post title</b></a>
    <a href="/news">News index</a><a href="/research/x">Short</a><a href="mailto:a@b.c">Email me please</a>`;
  const items = parseHtmlLinks(html, { baseUrl: 'https://www.anthropic.com/news', include: /^\/news\/[a-z0-9-]+$/ });
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://www.anthropic.com/news/first-post');
  assert.equal(items[1].title, 'Second post title');
});

test('decodes html entities', () => {
  assert.equal(decodeEntities('a &amp; b &#39;c&#39; &#x41; &nbsp;'), "a & b 'c' A  ");
});
