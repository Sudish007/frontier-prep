// Minimal HTTP client for the fetch pipeline: timeout, one retry on 5xx/429/network,
// browser-ish Accept header, and a stable error class string for data/meta.json.

export const USER_AGENT = 'frontier-prep-bot/0.1 (+https://github.com/Sudish007/frontier-prep)';

const DEFAULT_ACCEPT =
  'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, application/json;q=0.9, text/html;q=0.8, */*;q=0.5';

export async function fetchText(url, options = {}) {
  const {
    timeoutMs = 20_000,
    headers = {},
    retries = 1,
    fetchImpl = globalThis.fetch,
    method = 'GET',
  } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method,
        headers: { 'user-agent': USER_AGENT, accept: DEFAULT_ACCEPT, ...headers },
        signal: controller.signal,
        redirect: 'follow',
      });
      const body = method === 'HEAD' ? '' : await response.text();
      if (!response.ok) {
        const error = new Error(`http ${response.status}`);
        error.status = response.status;
        error.body = body.slice(0, 200);
        lastError = error;
        if (response.status >= 500 || response.status === 429) continue;
        throw error;
      }
      return {
        status: response.status,
        body,
        contentType: response.headers.get('content-type') || '',
        url: response.url || url,
      };
    } catch (error) {
      lastError = error?.name === 'AbortError' ? Object.assign(new Error('timeout'), { code: 'TIMEOUT' }) : error;
      if (lastError.status && lastError.status < 500 && lastError.status !== 429) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// Turns any thrown value into a short, stable classification (max 120 chars) so
// the Feed page can show "Unavailable since <date>: <class>" without leaking payloads.
export function errorClass(error) {
  if (!error) return 'unknown';
  if (error.status) {
    const hint = /cloudflare|attention required|just a moment/i.test(error.body || '') ? ' Cloudflare' : '';
    return clip(`${error.status >= 400 && error.status < 500 && error.status !== 429 ? 'blocked' : 'http'}: ${error.status}${hint}`);
  }
  const code = error.code || error.cause?.code;
  if (code === 'TIMEOUT') return 'timeout';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `dns: ${code}`;
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT') return `net: ${code}`;
  if (code && /CERT|TLS|SSL|LEAF|SIGNATURE/i.test(code)) return `tls: ${code}`;
  if (error.name === 'SyntaxError') return clip(`parse: ${error.message}`);
  return clip(`${error.name || 'error'}: ${error.message || String(error)}`);
}

function clip(text) {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 120);
}
