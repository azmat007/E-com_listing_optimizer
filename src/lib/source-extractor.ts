import { NextResponse } from 'next/server';

export type SourceResult = {
  text: string;
  images: string[];
  title?: string;
  features?: string;
};

export function extractFromUrl(urlStr: string): SourceResult {
  try {
    const u = new URL(urlStr);
    const segments = u.pathname.split('/').filter(Boolean);
    const decode = (s: string) => decodeURIComponent(s).trim();
    const scored = segments
      .map((seg) => decode(seg))
      .filter((seg) => seg.length > 1)
      .map((seg) => ({
        seg,
        score: seg.length + (seg.includes('-') ? 0 : 0) + (seg.includes('version') ? 2 : 0) + (seg.includes('gb') ? 2 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const candidate = scored[0]?.seg || segments.filter(Boolean).pop() || '';
    const title = candidate.replace(/[-\s]+/g, ' ').trim();
    const domain = u.hostname;
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
  const description = matchMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    matchMeta(html, /<meta[^>]+property=["']description["'][^>]+content=["']([^"']+)["']/i);
  return { title: title || undefined, description: description || undefined };
}

function extractImages(html: string): string[] {
  const tags = Array.from(new Set((html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || []) as string[]));
  const urls = tags
    .map((tag) => (tag.match(/src=["']([^"']+)["']/) || [])[1])
    .filter((src): src is string => Boolean(src))
    .filter((src) => /^https?:\/\//.test(src))
    .filter((src) => !/data:image\/svg\+xml/.test(src))
    .filter((src) => !/sprite|icon|logo|1x1|pixel|transparent|badge|flags/i.test(src))
    .slice(0, 20);
  return Array.from(new Set(urls));
}

export async function fetchSourceText(url: string): Promise<SourceResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const init: RequestInit = {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    };
    const res = await fetch(url, init);
    clearTimeout(timeout);
    if (!res.ok) {
      return { ...extractFromUrl(url), images: [] };
    }
    const html = await res.text();

    const og = extractOpenGraph(html);
    const standard = extractStandardMeta(html);
    const title = og.title || standard.title || '';
    const description = og.description || standard.description || '';
    const ld = extractJsonLd(html);
    const bodyText = cleanBodyText(html);

    const parts = [title, description, bodyText, ...ld].filter(Boolean);
    const text = parts.join('\n').slice(0, 14000);
    const images = extractImages(html);

    if (!text && !images.length) {
      const urlFallback = extractFromUrl(url);
      return { text: [urlFallback.text, text].filter(Boolean).join('\n'), images: [...urlFallback.images, ...images] };
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
  let points = [
    title ? `Detected title: ${title}` : null,
    features ? `Detected description: ${features}` : null,
    `Extracted source images: ${source.images.length}`,
    source.images.length ? `Sample image: ${source.images[0]}` : null,
    `Full text length: ${source.text.length} chars`,
  ].filter(Boolean) as string[];

  if (points.length === 0) {
    points = ['Page was not readable. Showing URL-derived cues only.'];
  }

  if (!title || !features) {
    points = [
      ...points,
      urlHint.title && !title ? `URL-derived title: ${urlHint.title}` : null,
      'Extracted fallback cues from URL/headers because page content was limited.',
    ].filter(Boolean) as string[];
  }

  return { points, images: source.images.slice(0, 8), title, description: features };
}
