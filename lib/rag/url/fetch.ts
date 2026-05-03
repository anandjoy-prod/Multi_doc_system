// =============================================================================
// SSRF-safe URL fetcher + main-content extractor.
//
// We're letting users tell our server to GET arbitrary URLs. That is a
// classic SSRF vector — the server has more network access than the user.
// Defenses (defense in depth, in order of stopping power):
//
//   1. Reject schemes other than http/https
//   2. Resolve hostname → reject private IP ranges (cloud metadata, RFC1918,
//      loopback, link-local). The DNS resolution happens BEFORE fetch so an
//      attacker can't use a host that resolves to 169.254.169.254.
//   3. Cap response body to 5MB
//   4. 30s overall timeout
//   5. Reject non-HTML Content-Type
//   6. Block CONNECT/redirect to file:// schemes (default fetch behaviour)
//
// Extraction uses @mozilla/readability — the same algorithm Firefox Reader
// View uses. Drops nav/header/footer/aside cleanly.
// =============================================================================

import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 30_000;

export interface ExtractedPage {
  url: string;
  title: string;
  text: string;
  byteSize: number;
}

export class UrlFetchError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string = message,
  ) {
    super(message);
    this.name = 'UrlFetchError';
  }
}

export async function fetchAndExtract(rawUrl: string): Promise<ExtractedPage> {
  const url = parseUrl(rawUrl);
  await assertPublicHost(url.hostname);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        // ASCII only — HTTP headers must be Latin-1 (codepoints 0..255).
        'User-Agent':
          'AI-Chat-CMS/0.1 (+https://github.com - RAG ingestion bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof Error ? err.message : 'fetch failed';
    throw new UrlFetchError(reason, `Could not fetch URL: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new UrlFetchError(
      `${res.status} ${res.statusText}`,
      `Server returned ${res.status} ${res.statusText}`,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    throw new UrlFetchError(
      `unsupported content-type ${contentType}`,
      'Only HTML pages are supported (got ' +
        (contentType.split(';')[0] || 'unknown') +
        ').',
    );
  }

  // Read the body with a hard size cap. Stops a malicious server from
  // streaming 50 GB into our memory.
  const html = await readWithCap(res, MAX_BYTES);

  // Re-resolve the FINAL URL (after redirects) and re-check it's still
  // public — protects against a server that redirects to 127.0.0.1.
  const finalUrl = parseUrl(res.url || rawUrl);
  await assertPublicHost(finalUrl.hostname);

  const extracted = extractMain(html, finalUrl.toString());
  if (!extracted.text || extracted.text.length < 100) {
    throw new UrlFetchError(
      'extracted content too short',
      'Could not extract meaningful content. Page may require JavaScript or be paywalled.',
    );
  }

  return {
    url: finalUrl.toString(),
    title: extracted.title,
    text: extracted.text,
    byteSize: html.length,
  };
}

// ----- helpers --------------------------------------------------------------

function parseUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UrlFetchError('invalid URL', 'That is not a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlFetchError(
      'unsupported protocol',
      'Only http:// and https:// URLs are allowed.',
    );
  }
  return parsed;
}

/**
 * Resolve the hostname and refuse private/loopback/link-local addresses.
 * If the hostname is already an IP literal, validate that directly.
 */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UrlFetchError(
        'private host blocked',
        'URLs pointing to private/internal addresses are not allowed.',
      );
    }
    return;
  }
  let addrs: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addrs = records.map((r) => r.address);
  } catch {
    throw new UrlFetchError('dns lookup failed', 'Could not resolve hostname.');
  }
  for (const a of addrs) {
    if (isPrivateIp(a)) {
      throw new UrlFetchError(
        'private host blocked',
        'URLs pointing to private/internal addresses are not allowed.',
      );
    }
  }
}

function isPrivateIp(addr: string): boolean {
  // IPv4
  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number) as [number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;            // link-local
    if (a === 172 && b! >= 16 && b! <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true;                          // multicast/reserved
    return false;
  }
  // IPv6 — be conservative: block loopback, link-local, ULA.
  const lower = addr.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true;            // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  return false;
}

async function readWithCap(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      reader.cancel();
      throw new UrlFetchError(
        'response too large',
        `Page is larger than ${max / 1024 / 1024} MB.`,
      );
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

function extractMain(
  html: string,
  url: string,
): { title: string; text: string } {
  // linkedom gives us a DOM Readability can walk.
  const { document } = parseHTML(html);

  // Readability mutates the document; clone first.
  const reader = new Readability(document.cloneNode(true) as Document);
  const article = reader.parse();

  if (article && article.textContent) {
    return {
      title: cleanTitle(article.title || document.title || url),
      text: normalize(article.textContent),
    };
  }

  // Fallback: strip nav/aside/header/footer and pull body text.
  for (const sel of ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside']) {
    document.querySelectorAll(sel).forEach((el: Element) => el.remove());
  }
  const text = (document.body?.textContent ?? '').trim();
  return {
    title: cleanTitle(document.title || url),
    text: normalize(text),
  };
}

function cleanTitle(t: string): string {
  return t.replace(/\s+/g, ' ').trim().slice(0, 200) || 'Untitled page';
}

function normalize(t: string): string {
  return t.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}
