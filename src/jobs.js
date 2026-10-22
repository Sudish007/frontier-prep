// Job-board fetchers. Each returns [{ id, company, title, location, url, postedAt, remote }]
// from the public JSON endpoints the companies' own careers sites use. Google has no such
// endpoint, so it is listed as a "manual" board (link only) in sources.config.mjs.

import { fetchText } from './http.js';

export const ROLE_PATTERN =
  /\b(applied ai|forward deployed|solutions? (architect|engineer)|deployment engineer|machine learning|\bml\b|mle|ai engineer|genai|generative ai|research (engineer|scientist)|member of technical staff|applied scientist|data scientist|llm|agent|evaluation|evals?|alignment|safety|interpretability|developer relations|technical success|customer engineer)\b/i;

export const INDIA_PATTERN = /\b(india|bengaluru|bangalore|hyderabad|delhi|gurgaon|gurugram|mumbai|pune|chennai|noida)\b/i;
export const REMOTE_PATTERN = /\bremote\b/i;

export function matchesRole(title) {
  return ROLE_PATTERN.test(title || '');
}

export function locationFlags(location) {
  const text = String(location || '');
  return { india: INDIA_PATTERN.test(text), remote: REMOTE_PATTERN.test(text) };
}

export async function fetchGreenhouse(board, options = {}) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.slug)}/jobs`;
  const { body } = await fetchText(url, { ...options, headers: { accept: 'application/json' } });
  const data = JSON.parse(body);
  return (data.jobs || []).map((job) => ({
    id: `gh-${board.slug}-${job.id}`,
    company: board.company,
    title: job.title,
    location: job.location?.name || '',
    url: job.absolute_url,
    postedAt: isoOrNull(job.first_published || job.updated_at),
  }));
}

export async function fetchAshby(board, options = {}) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.slug)}?includeCompensation=false`;
  const { body } = await fetchText(url, { ...options, headers: { accept: 'application/json' } });
  const data = JSON.parse(body);
  return (data.jobs || []).map((job) => ({
    id: `ashby-${board.slug}-${job.id}`,
    company: board.company,
    title: job.title,
    location: [job.location, ...(job.secondaryLocations || []).map((l) => l.location)].filter(Boolean).join('; ') + (job.isRemote ? '; Remote' : ''),
    url: job.jobUrl || job.applyUrl,
    postedAt: isoOrNull(job.publishedAt),
  }));
}

export async function fetchAmazon(board, options = {}) {
  const params = new URLSearchParams({
    base_query: board.query,
    offset: '0',
    result_limit: '100',
    sort: 'recent',
  });
  if (board.country) params.append('normalized_country_code[]', board.country);
  if (board.location) params.set('loc_query', board.location);
  const url = `https://www.amazon.jobs/en/search.json?${params}`;
  const { body } = await fetchText(url, { ...options, headers: { accept: 'application/json' } });
  const data = JSON.parse(body);
  return (data.jobs || []).map((job) => ({
    id: `amzn-${job.id_icims || job.id}`,
    company: board.company,
    title: job.title,
    location: job.normalized_location || job.location || '',
    url: job.job_path ? new URL(job.job_path, 'https://www.amazon.jobs').toString() : '',
    postedAt: isoOrNull(job.posted_date || job.updated_time),
  }));
}

export async function fetchMicrosoft(board, options = {}) {
  const params = new URLSearchParams({
    q: board.query,
    lc: board.location || '',
    l: 'en_us',
    pg: '1',
    pgSz: '50',
    o: 'Recent',
    flt: 'true',
  });
  const url = `https://gcsservices.careers.microsoft.com/search/api/v1/search?${params}`;
  const { body } = await fetchText(url, { ...options, headers: { accept: 'application/json' } });
  const data = JSON.parse(body);
  const jobs = data.operationResult?.result?.jobs || [];
  return jobs.map((job) => ({
    id: `msft-${job.jobId}`,
    company: board.company,
    title: job.title,
    location: (job.properties?.locations || []).join('; ') || job.properties?.primaryLocation || '',
    url: `https://jobs.careers.microsoft.com/global/en/job/${job.jobId}`,
    postedAt: isoOrNull(job.postingDate),
  }));
}

const FETCHERS = { greenhouse: fetchGreenhouse, ashby: fetchAshby, amazon: fetchAmazon, microsoft: fetchMicrosoft };

export async function fetchBoard(board, options = {}) {
  const fetcher = FETCHERS[board.kind];
  if (!fetcher) throw new Error(`unknown board kind: ${board.kind}`);
  const raw = await fetcher(board, options);
  return filterJobs(raw, board);
}

export function filterJobs(jobs, board = {}) {
  const roleFilter = board.roleFilter === false ? () => true : matchesRole;
  return jobs
    .filter((job) => job.url && job.title && roleFilter(job.title))
    .map((job) => {
      const flags = locationFlags(job.location);
      return { ...job, india: flags.india, remote: flags.remote, board: board.id };
    });
}

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
