// Source registry. One object per source. `class` picks the parser: rss|atom|html-links.
// `topics` tags items for the Feed filters. `filter` (regex) keeps only matching items.
// Order within a class does not matter; the pipeline fetches with 4 workers.

const LLM_TERMS =
  /\b(llm|language model|gpt|claude|gemini|transformer|agent|agentic|rag|retrieval|fine[- ]?tun|rlhf|dpo|alignment|interpretab|eval|benchmark|inference|kv[- ]cache|prompt|tool[- ]use|mcp|reasoning|safety|red[- ]team|jailbreak|scaling)\b/i;

export const sources = [
  // Lab blogs and news
  { id: 'anthropic-news', name: 'Anthropic news', class: 'html-links', kind: 'lab', url: 'https://www.anthropic.com/news', include: /^\/news\/[a-z0-9-]+$/i, topics: ['anthropic'], homepage: 'https://www.anthropic.com/news', note: 'no feed; links scraped, dated by first sighting' },
  { id: 'anthropic-research', name: 'Anthropic research', class: 'html-links', kind: 'lab', url: 'https://www.anthropic.com/research', include: /^\/research\/[a-z0-9-]+$/i, topics: ['anthropic', 'research'], homepage: 'https://www.anthropic.com/research', note: 'no feed; links scraped' },
  { id: 'anthropic-engineering', name: 'Anthropic engineering', class: 'html-links', kind: 'lab', url: 'https://www.anthropic.com/engineering', include: /^\/(engineering|research)\/[a-z0-9-]+$/i, topics: ['anthropic', 'engineering'], homepage: 'https://www.anthropic.com/engineering', note: 'no feed; links scraped (engineering posts now live under /research)' },
  { id: 'anthropic-alignment', name: 'Anthropic Alignment Science blog', class: 'html-links', kind: 'lab', url: 'https://alignment.anthropic.com/', include: /^\/\d{4}\/[a-z0-9-]+\/?$/i, topics: ['anthropic', 'alignment'], homepage: 'https://alignment.anthropic.com/', note: 'no feed; links scraped' },
  { id: 'openai-news', name: 'OpenAI news', class: 'rss', kind: 'lab', url: 'https://openai.com/news/rss.xml', topics: ['openai'], homepage: 'https://openai.com/news' },
  { id: 'deepmind-blog', name: 'Google DeepMind blog', class: 'rss', kind: 'lab', url: 'https://deepmind.google/blog/rss.xml', topics: ['google'], homepage: 'https://deepmind.google/blog' },
  { id: 'google-research', name: 'Google Research blog', class: 'rss', kind: 'lab', url: 'https://research.google/blog/rss/', topics: ['google', 'research'], homepage: 'https://research.google/blog/' },
  { id: 'msr-blog', name: 'Microsoft Research blog', class: 'rss', kind: 'lab', url: 'https://www.microsoft.com/en-us/research/feed/', topics: ['microsoft', 'research'], homepage: 'https://www.microsoft.com/en-us/research/blog/' },
  { id: 'aws-ml-blog', name: 'AWS Machine Learning blog', class: 'rss', kind: 'lab', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', topics: ['amazon'], homepage: 'https://aws.amazon.com/blogs/machine-learning/' },
  { id: 'amazon-science', name: 'Amazon Science', class: 'rss', kind: 'lab', url: 'https://www.amazon.science/index.rss', topics: ['amazon', 'research'], homepage: 'https://www.amazon.science/' },
  { id: 'hf-blog', name: 'Hugging Face blog', class: 'rss', kind: 'community', url: 'https://huggingface.co/blog/feed.xml', topics: ['engineering'], homepage: 'https://huggingface.co/blog' },
  { id: 'simon-willison', name: "Simon Willison's weblog", class: 'atom', kind: 'community', url: 'https://simonwillison.net/atom/everything/', topics: ['engineering'], filter: LLM_TERMS, homepage: 'https://simonwillison.net/' },
  { id: 'lilian-weng', name: "Lil'Log (Lilian Weng)", class: 'rss', kind: 'community', url: 'https://lilianweng.github.io/index.xml', topics: ['research', 'fundamentals'], homepage: 'https://lilianweng.github.io/' },
  { id: 'interconnects', name: 'Interconnects (Nathan Lambert)', class: 'rss', kind: 'community', url: 'https://www.interconnects.ai/feed', topics: ['research'], homepage: 'https://www.interconnects.ai/' },
  { id: 'latent-space', name: 'Latent Space', class: 'rss', kind: 'community', url: 'https://www.latent.space/feed', topics: ['engineering'], homepage: 'https://www.latent.space/' },
  { id: 'alignment-forum', name: 'Alignment Forum', class: 'rss', kind: 'community', url: 'https://www.alignmentforum.org/feed.xml?view=curated-rss', topics: ['alignment'], homepage: 'https://www.alignmentforum.org/' },
  { id: 'import-ai', name: 'Import AI (Jack Clark)', class: 'rss', kind: 'community', url: 'https://importai.substack.com/feed', topics: ['research', 'policy'], homepage: 'https://importai.substack.com/' },

  // Papers
  { id: 'arxiv-cs-cl', name: 'arXiv cs.CL (LLM-filtered)', class: 'atom', kind: 'papers', url: 'https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=100', topics: ['papers'], filter: /\b(llm|language model|agent|alignment|rlhf|eval|benchmark|reasoning|retrieval|instruction|preference|reward)\b/i, limit: 40, homepage: 'https://arxiv.org/list/cs.CL/recent' },
  { id: 'arxiv-interp-safety', name: 'arXiv: interpretability and safety', class: 'atom', kind: 'papers', url: 'https://export.arxiv.org/api/query?search_query=all:%22mechanistic%20interpretability%22%20OR%20all:%22AI%20safety%22%20OR%20all:%22alignment%20faking%22%20OR%20all:%22reward%20hacking%22&sortBy=submittedDate&sortOrder=descending&max_results=50', topics: ['papers', 'alignment'], limit: 30, homepage: 'https://arxiv.org/list/cs.AI/recent' },
  { id: 'arxiv-agents-evals', name: 'arXiv: agents and evaluation', class: 'atom', kind: 'papers', url: 'https://export.arxiv.org/api/query?search_query=all:%22LLM%20agents%22%20OR%20all:%22tool%20use%22%20OR%20all:%22agent%20benchmark%22%20OR%20all:%22LLM%20evaluation%22&sortBy=submittedDate&sortOrder=descending&max_results=50', topics: ['papers', 'engineering'], limit: 30, homepage: 'https://arxiv.org/list/cs.AI/recent' },

  // YouTube channels (uploads feeds; no API key needed)
  { id: 'yt-karpathy', name: 'Andrej Karpathy (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXUPKJO5MZQN11PqgIvyuvQ', topics: ['fundamentals', 'video'], homepage: 'https://www.youtube.com/@AndrejKarpathy' },
  { id: 'yt-anthropic', name: 'Anthropic (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA', topics: ['anthropic', 'video'], homepage: 'https://www.youtube.com/@anthropic-ai' },
  { id: 'yt-openai', name: 'OpenAI (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A', topics: ['openai', 'video'], homepage: 'https://www.youtube.com/@OpenAI' },
  { id: 'yt-deepmind', name: 'Google DeepMind (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A', topics: ['google', 'video'], homepage: 'https://www.youtube.com/@Google_DeepMind' },
  { id: 'yt-3b1b', name: '3Blue1Brown (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw', topics: ['fundamentals', 'video'], homepage: 'https://www.youtube.com/@3blue1brown' },
  { id: 'yt-yannic', name: 'Yannic Kilcher (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew', topics: ['papers', 'video'], homepage: 'https://www.youtube.com/@YannicKilcher' },
  { id: 'yt-ai-explained', name: 'AI Explained (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw', topics: ['research', 'video'], homepage: 'https://www.youtube.com/@aiexplained-official' },
  { id: 'yt-stanford-online', name: 'Stanford Online (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCBa5G_ESCn8Yd4vw5U-gIcg', topics: ['fundamentals', 'video'], filter: /\b(cs\s?\d{3}|machine learning|deep learning|transformer|language model|nlp|reinforcement)\b/i, homepage: 'https://www.youtube.com/@stanfordonline' },
  { id: 'yt-hello-interview', name: 'Hello Interview (YouTube)', class: 'atom', kind: 'video', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC3kf-QFT6FZzDk9JsPg8Svg', topics: ['interview', 'video'], homepage: 'https://www.youtube.com/@hello_interview' },
  { id: 'google-ai-blog', name: 'Google: The Keyword, AI', class: 'rss', kind: 'lab', url: 'https://blog.google/technology/ai/rss/', topics: ['google'], homepage: 'https://blog.google/technology/ai/' },

  // Interview-process and career trackers. IGotAnOffer and Exponent/Aced have no reachable feed
  // (Cloudflare 403 / no RSS), so interviewing.io's blog index is scraped for links instead.
  { id: 'interviewing-io-blog', name: 'interviewing.io blog', class: 'html-links', kind: 'interview', url: 'https://interviewing.io/blog', include: /^\/blog\/[a-z0-9-]+$/i, topics: ['interview'], homepage: 'https://interviewing.io/blog', note: 'no feed; links scraped, dated by first sighting' },
  { id: 'pragmatic-engineer', name: 'The Pragmatic Engineer', class: 'rss', kind: 'community', url: 'https://newsletter.pragmaticengineer.com/feed', topics: ['career'], filter: /\b(interview|hiring|ai|llm|agent|anthropic|openai|career|resume|cv)\b/i, homepage: 'https://newsletter.pragmaticengineer.com/' },

  // Releases worth knowing for the LLM implementation round
  { id: 'rel-anthropic-sdk-py', name: 'anthropic-sdk-python releases', class: 'atom', kind: 'release', url: 'https://github.com/anthropics/anthropic-sdk-python/releases.atom', topics: ['anthropic', 'engineering'], homepage: 'https://github.com/anthropics/anthropic-sdk-python' },
  { id: 'rel-claude-code', name: 'claude-code releases', class: 'atom', kind: 'release', url: 'https://github.com/anthropics/claude-code/releases.atom', topics: ['anthropic', 'engineering'], homepage: 'https://github.com/anthropics/claude-code' },
  { id: 'rel-mcp-py', name: 'MCP python-sdk releases', class: 'atom', kind: 'release', url: 'https://github.com/modelcontextprotocol/python-sdk/releases.atom', topics: ['engineering'], homepage: 'https://github.com/modelcontextprotocol/python-sdk' },
  { id: 'rel-openai-py', name: 'openai-python releases', class: 'atom', kind: 'release', url: 'https://github.com/openai/openai-python/releases.atom', topics: ['openai', 'engineering'], homepage: 'https://github.com/openai/openai-python' },
  { id: 'rel-openai-agents', name: 'openai-agents-python releases', class: 'atom', kind: 'release', url: 'https://github.com/openai/openai-agents-python/releases.atom', topics: ['openai', 'engineering'], homepage: 'https://github.com/openai/openai-agents-python' },
  { id: 'rel-inspect', name: 'inspect_ai releases', class: 'atom', kind: 'release', url: 'https://github.com/UKGovernmentBEIS/inspect_ai/releases.atom', topics: ['engineering', 'evals'], homepage: 'https://github.com/UKGovernmentBEIS/inspect_ai' },
  { id: 'rel-vllm', name: 'vLLM releases', class: 'atom', kind: 'release', url: 'https://github.com/vllm-project/vllm/releases.atom', topics: ['engineering', 'inference'], homepage: 'https://github.com/vllm-project/vllm' },
];

// Job boards. Greenhouse and Ashby expose public JSON; Amazon and Microsoft have public search
// JSON used by their own career pages. Google has no public JSON endpoint, so it is `manual`.
export const jobBoards = [
  { id: 'anthropic', company: 'Anthropic', kind: 'greenhouse', slug: 'anthropic', url: 'https://www.anthropic.com/careers/jobs' },
  { id: 'openai', company: 'OpenAI', kind: 'ashby', slug: 'openai', url: 'https://openai.com/careers/search/' },
  { id: 'amazon-genai-india', company: 'Amazon', kind: 'amazon', query: 'generative AI', country: 'IND', url: 'https://www.amazon.jobs/en/search?base_query=generative+AI&country=IND' },
  { id: 'amazon-ml-india', company: 'Amazon', kind: 'amazon', query: 'machine learning', country: 'IND', url: 'https://www.amazon.jobs/en/search?base_query=machine+learning&country=IND' },
  // Microsoft's search API host (gcsservices.careers.microsoft.com) serves a certificate for a
  // different name, so it cannot be fetched reliably; listed as a manual check.
  { id: 'microsoft-manual', company: 'Microsoft', kind: 'manual', url: 'https://jobs.careers.microsoft.com/global/en/search?q=AI&lc=India' },
  { id: 'google-manual', company: 'Google / DeepMind', kind: 'manual', url: 'https://www.google.com/about/careers/applications/jobs/results?q=%22machine%20learning%22%20OR%20%22AI%20engineer%22&location=India' },
];
