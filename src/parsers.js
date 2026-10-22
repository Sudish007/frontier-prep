// Feed parsers: RSS 2.0, Atom (incl. arXiv and YouTube), RDF/RSS 1.0, and a tolerant
// HTML link extractor for pages that publish no feed (e.g. anthropic.com/news).
// Every parser returns [{ title, url, publishedAt, summary }] with publishedAt as an
// ISO string or null. Nothing here touches the network.

import { XMLParser } from 'fast-xml-parser';

const ARRAY_TAGS = new Set(['item', 'entry', 'link', 'category', 'author']);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  trimValues: true,
  processEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

export function parseFeed(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  let doc;
  try {
    doc = xml.parse(text);
  } catch (error) {
    const wrapped = new SyntaxError(`feed xml: ${error.message}`);
    throw wrapped;
  }
  if (doc.rss?.channel) return rssItems(doc.rss.channel);
  if (doc.feed) return atomEntries(doc.feed);
  if (doc['rdf:RDF']) return rdfItems(doc['rdf:RDF']);
  throw new SyntaxError('feed xml: no rss/feed/rdf root');
}

function rssItems(channel) {
  const items = channel.item || [];
  return items
    .map((item) => ({
      title: textOf(item.title),
      url: firstUrl(item.link) || textOf(item.guid) || '',
      publishedAt: toIso(textOf(item.pubDate) || textOf(item['dc:date']) || textOf(item['atom:updated'])),
      summary: textOf(item.description) || textOf(item['content:encoded']) || '',
    }))
    .filter((item) => item.url && item.title);
}

function atomEntries(feed) {
  const entries = feed.entry || [];
  return entries
    .map((entry) => {
      const links = entry.link || [];
      const alternate = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') || links[0];
      const url = alternate?.['@_href'] || textOf(entry.id) || '';
      return {
        title: textOf(entry.title),
        url,
        publishedAt: toIso(textOf(entry.published) || textOf(entry.updated)),
        summary: textOf(entry.summary) || textOf(entry.content) || textOf(entry['media:group']?.['media:description']) || '',
      };
    })
    .filter((item) => item.url && item.title);
}

function rdfItems(rdf) {
  const items = rdf.item || [];
  return items
    .map((item) => ({
      title: textOf(item.title),
      url: textOf(item.link) || item['@_rdf:about'] || '',
      publishedAt: toIso(textOf(item['dc:date'])),
      summary: textOf(item.description) || '',
    }))
    .filter((item) => item.url && item.title);
}

function firstUrl(link) {
  if (Array.isArray(link)) {
    for (const l of link) {
      const value = firstUrl(l);
      if (value) return value;
    }
    return '';
  }
  if (link && typeof link === 'object') return link['@_href'] || textOf(link);
  return textOf(link);
}

export function textOf(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return textOf(value[0]);
  if (typeof value === 'object') {
    if (value['#cdata'] != null) return String(value['#cdata']).trim();
    if (value['#text'] != null) return String(value['#text']).trim();
    if (value.name != null) return textOf(value.name);
    return '';
  }
  return String(value).trim();
}

export function toIso(text) {
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Extracts anchors whose resolved pathname matches `include` (regex) and does not match
// `exclude`. Titles are the anchor text with tags stripped. Items carry no date; the
// pipeline stamps firstSeen so the item still ages out of the window.
export function parseHtmlLinks(html, { baseUrl, include, exclude = null, minTitleLength = 12 }) {
  if (typeof html !== 'string') return [];
  const out = new Map();
  const anchor = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchor.exec(html)) !== null) {
    const href = match[1] ?? match[2] ?? '';
    const title = decodeEntities(match[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!href || href.startsWith('#') || /^(mailto|javascript|tel):/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!include.test(url.pathname)) continue;
    if (exclude && exclude.test(url.pathname)) continue;
    if (title.length < minTitleLength) continue;
    url.hash = '';
    const key = url.toString();
    if (!out.has(key)) out.set(key, { title, url: key, publishedAt: null, summary: '' });
  }
  return [...out.values()];
}

export function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
