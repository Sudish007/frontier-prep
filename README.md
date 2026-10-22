# Frontier Prep

One place to prepare for AI roles at Anthropic, OpenAI, Google and Google DeepMind, Microsoft and Amazon: a 12-month roadmap with checkpoints, a timer-driven practice log, a question bank of 250+ reported interview questions with provenance, a library of 160+ curated courses, videos, books, papers, docs and tools, company profiles, and a feed and jobs watch that refresh themselves every six hours on GitHub Actions.

Live site (after the first deploy): https://sudish007.github.io/frontier-prep/

Static site, no build step, no framework, one runtime dependency (`fast-xml-parser`, used only by the fetch pipeline). All progress (checkboxes, practice sessions, saved items) lives in the browser's `localStorage` under `frontier-prep.v1.*`; nothing leaves the browser. The Roadmap page can export and import that state as JSON.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Stats, "where you are" progress, this week's blocks from the roadmap, priority-one resources not yet done, latest feed items, new India roles |
| `roadmap.html` | Target roles by tier, the gap table, phases with checkable tasks, checkpoints with live counts from the practice log, skill pillars linked to resources, flagship projects, weekly template, export/import/reset |
| `practice.html` | Draws one of the twelve coding shapes (or a bank question, design or values prompt), runs a timer, logs sessions; totals are compared with the next checkpoint |
| `questions.html` | 257 questions, filterable by company, round and provenance (R reported, O official, S representative); each links to its source; mark practiced |
| `resources.html` | 167 curated resources with pillar, kind, cost, level, priority, hours and a one-line reason; a second view lists auto-discovered candidates from the feed |
| `companies.html` | Per-company India hiring, loop shape, what fails people, AI-usage policy, values, read-first list, open India roles |
| `feed.html` | Items from 39 sources with filters and read/saved state, plus a per-source status table |
| `jobs.html` | Matching roles from the public Anthropic (Greenhouse), OpenAI (Ashby) and Amazon job APIs, India/remote filters, "new since last visit", board status; Microsoft and Google are manual links |

## Content (the curated part)

- `content/resources.json`: the library. Each item has `id`, `title`, `url`, `kind`, `pillar`, `cost`, `level`, `hours`, `companies`, `priority` (1 = do first) and `why`. Add a resource by appending an object; `npm test` validates the shape and `npm run check-links` checks the URL.
- `content/questions.json`: the question bank. Each item has `company`, `round`, `tag` (R/O/S), `source` (a key into `sources`), `q` and an optional `shape` that links it to a practice shape.
- `content/roadmap.json`: targets, gaps, phases and tasks, checkpoints with metric targets, weekly template, pillars, flagship projects and the twelve coding shapes.
- `content/companies.json`: the five company profiles.

Content from third-party interview guides was paraphrased; every question carries its source URL.

## Data (the self-updating part)

```
sources.config.mjs ──▶ scripts/fetch.mjs ──▶ src/pipeline.js
                                              fetch 39 sources with 4 workers (RSS, Atom, arXiv API, YouTube uploads, GitHub releases, scraped link indexes)
                                              normalize → dedupe by canonical URL → 45-day window → merge with previous feed.json
                                              classify resource candidates → data/discovered.json
                                              fetch job boards → role-title filter → India/remote flags → 60-day window → data/jobs.json
                                              per-source status → data/meta.json
assets/pages/*.js read content/*.json and data/*.json in the browser ◀── GitHub Pages serves the repo root
```

- Sources without a feed (anthropic.com news, research, engineering, the Alignment Science blog, interviewing.io's blog) are scraped for links and dated by first sighting, so they still age out of the window.
- `data/meta.json` records `ok`, `empty` or `failed` per source with an error class of at most 120 characters (`blocked: 403 Cloudflare`, `tls: ERR_TLS_CERT_ALTNAME_INVALID`, `timeout`). The Feed page shows failures as "unavailable since <date>", never hides them.
- A failed source or board keeps its previous items, so a network-dark runner never empties a page.
- `data/discovered.json` is heuristic: items whose title or summary looks like a course, tutorial, interview write-up, video or paper. It is a review queue for `content/resources.json`, not an endorsement.
- Microsoft's careers search API host serves a certificate for a different name, and Google has no public JSON endpoint, so both are manual links on the Jobs page. IGotAnOffer (Cloudflare 403) and Exponent/Aced (no feed) are not in the registry.
- No LLM calls, no API keys, no secrets.

## Run locally

Requires Node 22 or newer.

| Command | What it does |
|---|---|
| `npm ci` | installs `fast-xml-parser` |
| `npm test` | `node --test` over `tests/`: parsers, normalization, jobs and discovery, pipeline (with a fake fetch and a temp data dir), and content validation |
| `npm run fetch` | refreshes `data/*.json`; flags `--dry-run`, `--data-dir <dir>`, `--now <iso>`, `--source a,b` |
| `npm run serve` | serves the repo at http://127.0.0.1:8791/ and http://127.0.0.1:8791/frontier-prep/ (the Pages subpath) |
| `npm run check-links` | HEAD/GET every URL in `content/*.json`, writes `docs/check-links-report.json`; 403/429 are reported as blocked, only 404/410/DNS count as broken |
| `python scripts/audit.py --browser msedge --shots docs/screenshots/` | Playwright audit against the local server: console errors, failed requests, horizontal overflow at 390/1024/1440 px in both themes, light-first paint, 40 px control floor, page interactions; writes `docs/audit-report.json` and screenshots |
| `node scripts/probe.mjs <url>...` or `--jobs` | probe candidate source URLs, or print the India job matches in `data/jobs.json` |

## Deployment

`.github/workflows/refresh.yml` runs every six hours, on manual dispatch, and on pushes to `main` that touch anything but `data/`. One job: `npm ci`, `npm test`, `node scripts/fetch.mjs` (continue-on-error), commit `data/` back to `main` as `github-actions[bot]` with `[skip ci]`, stage `*.html`, `favicon.svg`, `assets/`, `content/`, `data/` into `_site/`, upload and deploy to GitHub Pages. Pages must be enabled with the GitHub Actions source before the first run; `configure-pages` has `enablement: true` to do that.

To publish:

```
cd frontier-prep
git init -b main
git add .
git commit -m "Frontier Prep: roadmap, question bank, resource library, feed and jobs watch"
gh repo create Sudish007/frontier-prep --public --source . --push
gh workflow run refresh.yml
```

## Keeping it fresh

- Every six hours the feed, discovered list and jobs refresh themselves.
- Weekly: open Resources → Auto-discovered, promote anything good into `content/resources.json`, dismiss the rest.
- After each real or mock interview round: add the questions you were asked to `content/questions.json` (tag `R`) with a source note.
- Monthly: `npm run check-links`, fix or remove broken resources.

## Repository layout

```
index.html roadmap.html practice.html questions.html resources.html companies.html feed.html jobs.html 404.html
assets/app.css          shared styles (light-first, dark theme, 44 px controls, print)
assets/app.js           chrome, theme, storage, data loading, helpers
assets/pages/*.js       one module per page
content/                resources.json, questions.json, roadmap.json, companies.json
data/                   feed.json, discovered.json, jobs.json, meta.json (written by fetch; refreshed by the workflow)
src/                    http.js, parsers.js, normalize.js, discover.js, jobs.js, pipeline.js
scripts/                fetch.mjs, serve.mjs, check-links.mjs, probe.mjs, audit.py
sources.config.mjs      the source registry and job boards
tests/                  node:test suites
docs/                   audit-report.json, screenshots/
.github/workflows/      refresh.yml
```

## Licence

MIT for the code (`LICENSE`). The curated content in `content/` is © Sudish Kumar.
