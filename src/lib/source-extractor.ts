import { NextResponse } from 'next/server';

export type SourceResult = {
  text: string;
  images: string[];
  title?: string;
  features?: string;
};

function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

export function extractFromUrl(urlStr: string): SourceResult {
  try {
    const u = new URL(urlStr);
    const segments = u.pathname.split('/').filter(Boolean);
    const domain = u.hostname.toLowerCase();

    const langLocance = segments.findIndex(s => /^[a-z]{2}-[a-z]{2}$/.test(s));

    if (domain.includes('noon.com')) {
      const startIdx = langLocance === -1 ? 0 : langLocance + 1;
      const slug = segments.slice(startIdx).find(s => !/^\/?P\d+$/i.test(s) && s !== 'p');
      const title = slug ? decodeSegment(slug) : '';
      const productCode = segments.find(s => /^P\d+$/i.test(s));
      return {
        text: productCode
          ? `Domain: ${domain}. Product code: ${productCode}. Product: ${title}`
          : title
            ? `Domain: ${domain}. Product: ${title}`
            : `Domain: ${domain}. URL: ${urlStr}`,
        images: [],
        title: title || undefined,
        features: productCode ? `Noon product code: ${productCode}` : undefined,
      };
    }

    if (domain.includes('amazon.') && (domain.endsWith('.com') || domain.endsWith('.ae') || domain.endsWith('.sa'))) {
      const slug = segments.find(s => /^[A-Z0-9]{10}$/.test(s)) || segments[segments.length - 1];
      const title = slug ? decodeSegment(slug).replace(/[-]+/g, ' ') : '';
      return {
        text: title ? `Domain: ${domain}. Product candidate: ${title}` : `Domain: ${domain}. URL: ${urlStr}`,
        images: [],
        title: title || undefined,
        features: segments.find(s => /^(gp\/product|dp)\//i.test(s)) ? 'Amazon product page' : undefined,
      };
    }

    const decoded = segments.map(decodeSegment).filter(s => s.length > 1);
    const scored = decoded.map(seg => ({
      seg,
      score: seg.length + (seg.includes('version') ? 2 : 0) + (/\d+gb/i.test(seg) ? 2 : 0),
    })).sort((a, b) => b.score - a.score);
    const candidate = scored[0]?.seg || decoded.pop() || '';
    const title = candidate.replace(/[-\s]+/g, ' ').trim();
    return {
      text: `Domain: ${domain}. URL title candidate: ${title}`,
      images: [],
      title: title || undefined,
      features: undefined,
    };
  } catch {
    return { text: '', images: [] };
  }
}

function cleanBodyText(html: string, limit = 8000): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function matchMeta(html: string, pattern: RegExp): string {
  const m = html.match(pattern);
  return m?.[1]?.trim() || '';
}

function extractJsonLd(html: string): string[] {
  const snippets: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const raw = m[1].trim();
      const obj = JSON.parse(raw);
      const text = typeof obj === 'string' ? raw : JSON.stringify(obj);
      snippets.push(text);
    } catch {
      snippets.push(m[1].trim());
    }
  }
  return snippets;
}

function extractOpenGraph(html: string): { title?: string; description?: string } {
  const title = matchMeta(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const description = matchMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  return { title: title || undefined, description: description || undefined };
}

function extractStandardMeta(html: string): { title?: string; description?: string } {
  const title =
    matchMeta(html, /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i) ||
    matchMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    matchMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    matchMeta(html, /<meta[^>]+property=["']description["'][^>]+content=["']([^"']+)["']/i);
  return { title: title || undefined, description: description || undefined };
}

function extractImages(html: string): string[] {
  const tags = Array.from(new Set((html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || []) as string[]));
  const urls = tags
    .map(tag => (tag.match(/src=["']([^"']+)["']/) || [])[1])
    .filter((src): src is string => Boolean(src))
    .filter(src => /^https?:\/\//.test(src))
    .filter(src => !/data:image\/svg\+xml/.test(src))
    .filter(src => !/sprite|icon|logo|1x1|pixel|transparent|badge|flags/i.test(src))
    .slice(0, 20);
  return Array.from(new Set(urls));
}

export async function fetchSourceText(url: string, fetcher: typeof fetch = fetch): Promise<SourceResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);
    const u = new URL(url);
    const marketplaceLang = u.pathname.split('/').find(s => /^[a-z]{2}-[a-z]{2}$/i.test(s)) || 'en-US';
    const init: RequestInit = {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': marketplaceLang + ',en;q=0.9',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'upgrade-insecure-requests': '1',
      },
    };
    const res = await fetch(url, init);
    clearTimeout(timeout);
    if (!res.ok) {
      return { ...extractFromUrl(url), images: [] };
    }
    let html = await res.text();

    // Noon-specific: f.nooncdn.com images
    const noonImages = Array.from(new Set((html.match(/https?:\/\/f\.nooncdn\.com\/[^"')\s]+/gi) || []) as string[])).slice(0, 20);

    const og = extractOpenGraph(html);
    const standard = extractStandardMeta(html);
    const title = og.title || standard.title || '';
    const description = og.description || standard.description || '';
    const ld = extractJsonLd(html);
    const bodyText = cleanBodyText(html);

    const parts = [title, description, bodyText, ...ld].filter(Boolean);
    const text = parts.join('\n').slice(0, 18000);
    const images = Array.from(new Set([...extractImages(html), ...noonImages]));

    if (!text && !images.length) {
      const urlFallback = extractFromUrl(url);
      return { text: [urlFallback.text].filter(Boolean).join('\n'), images: [...urlFallback.images] };
    }

    return {
      text,
      images,
      title: title || undefined,
      features: description || undefined,
    };
  } catch {
    return extractFromUrl(url);
  }
}

export function buildSourceValidPoints(source: SourceResult, url: string): { points: string[]; images: string[]; title?: string; description?: string } {
  const urlHint = extractFromUrl(url);
  const title = source.title || urlHint.title || '';
  const features = source.features || '';
  const points = [
    title ? `Detected title: ${title}` : null,
    features ? `Detected description: ${features}` : null,
    `Extracted source images: ${source.images.length}`,
    source.images.length ? `Sample image: ${source.images[0]}` : null,
    `Full text length: ${source.text.length} chars`,
  ].filter(Boolean) as string[];

  if (!title || !features) {
    points.push(urlHint.title && !title ? `URL-derived title: ${urlHint.title}` : null);
    points.push('Extracted fallback cues from URL/headers because page content was limited.');
  }

  return { points, images: source.images.slice(0, 8), title, description: features };
}

export async function verifyAmazonReachability(url: string): Promise<{ ok: boolean; reason?: string; reachableStatus?: number; redirected?: boolean; trace?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
    });
    clearTimeout(timeout);

    if (res.status === 404 || res.status === 410) {
      return { ok: false, reachableStatus: res.status, redirected: false, reason: 'Product page appears unavailable (not found).' };
    }
    if (res.status === 503 || res.status === 403) {
      return { ok: false, reachableStatus: res.status, redirected: false, reason: 'Source returned an access or bot-check page.' };
    }
    if (res.status >= 400) {
      return { ok: false, reachableStatus: res.status, redirected: false, reason: 'Source page returned an error status.' };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { ok: false, reachableStatus: res.status, redirected: false, reason: 'Response is not a product page.' };
    }

    let trace = '';
    try {
      const html = (await res.text()).slice(0, 4000);
      if (/Enter\s*mobile\s*number|OTP|captcha|Enter the characters/i.test(html)) {
        return { ok: false, reachableStatus: res.status, redirected: false, reason: 'Source showed a phone/OTP/CAPTCHA page.' };
      }
      trace = html.replace(/\s+/g, ' ').trim()
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .slice(0, 1800);
    } catch {}

    const redirected = res.redirected || false;
    return { ok: true, reachableStatus: res.status, redirected, trace };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    if (message.includes('aborted') || message.toLowerCase().includes('timeout')) {
      return { ok: false, reason: 'Request timed out while checking the source link.' };
    }
    if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
      return { ok: false, reason: 'Could not resolve the source domain.' };
    }
    return { ok: false, reason: 'Unable to verify source page at this time.' };
  }
}
