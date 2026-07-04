import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

async function fetchSourceText(url: string): Promise<{ text: string; images: string[]; title?: string; features?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
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
      return { text: '', images: [] };
    }
    const html = await res.text();

    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const images = Array.from(new Set((html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || []) as string[]))
      .map((tag) => (tag.match(/src=["']([^"']+)["']/) || [])[1])
      .filter((src: string | undefined): src is string => Boolean(src))
      .filter((src) => /^https?:\/\//.test(src))
      .filter((src) => !/data:image\/svg\+xml/.test(src))
      .filter((src) => !/sprite|icon|logo|1x1|pixel|transparent|badge|flags/.test(src))
      .slice(0, 20);

    const metaTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';

    const metaDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';

    const cleanBody = text
      .replace(metaTitle, '')
      .replace(metaDesc, '')
      .slice(0, 7000)
      .trim();

    return {
      text: [metaTitle, metaDesc, cleanBody].filter(Boolean).join(' | ').slice(0, 12000),
      images,
      title: metaTitle || undefined,
      features: metaDesc || undefined,
    };
  } catch {
    return { text: '', images: [] };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body as { url?: string };
    if (!url) return NextResponse.json({ error: 'Missing url.' }, { status: 400 });

    const source = await fetchSourceText(url);
    if (!source.text && source.images.length === 0) {
      return NextResponse.json({ error: 'Could not read useful content from this page.', status: 'unreachable' }, { status: 422 });
    }

    const points = [
      source.title ? `Detected title: ${source.title}` : null,
      source.features ? `Detected description: ${source.features}` : null,
      `Extracted source images: ${source.images.length}`,
      source.images.length ? `Sample image: ${source.images[0]}` : null,
      `Full text length: ${source.text.length} chars`,
    ].filter(Boolean) as string[];

    return NextResponse.json({
      accessible: true,
      points,
      images: source.images.slice(0, 6),
      title: source.title,
      description: source.features,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message, status: 'error' }, { status: 500 });
  }
}
