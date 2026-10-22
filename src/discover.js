// Promotes feed items that look like learning resources into data/discovered.json.
// Heuristic by design: a match means "worth a human look", never "added to the library".

const PATTERNS = [
  ['interview', /\b(interview|take-home|hiring process|coding challenge|system design round|behavioral round)\b/i],
  ['course', /\b(course|curriculum|syllabus|lecture|lectures|bootcamp|specialization|certificat(e|ion)|study plan|learning path|workshop)\b/i],
  ['tutorial', /\b(tutorial|walkthrough|from scratch|step[- ]by[- ]step|hands[- ]on|crash course|cookbook|handbook|playbook|how to build|how we built|deep dive|explained|primer|guide to)\b/i],
  ['paper', /\b(arxiv|preprint|we propose|benchmark|evaluation suite|technical report)\b/i],
];

export function classifyResource(item) {
  const haystack = `${item.title || ''} ${item.summary || ''}`;
  const matched = [];
  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(haystack)) matched.push(kind);
  }
  const host = hostOf(item.url);
  const isVideo = /youtube\.com|youtu\.be/.test(host);
  const isPaper = /arxiv\.org/.test(host);
  if (isPaper && !matched.includes('paper')) matched.push('paper');
  if (matched.length === 0) return null;
  let kind = matched[0];
  if (isVideo) kind = 'video';
  else if (isPaper) kind = 'paper';
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    summary: item.summary,
    publishedAt: item.publishedAt,
    firstSeen: item.firstSeen,
    source: item.source,
    sourceName: item.sourceName,
    kind,
    matched,
  };
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
