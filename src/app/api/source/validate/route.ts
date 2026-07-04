import { NextResponse } from 'next/server';
import { fetchSourceText, buildSourceValidPoints } from '@/lib/source-extractor';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body as { url?: string };
    if (!url) return NextResponse.json({ error: 'Missing url.' }, { status: 400 });
    const source = await fetchSourceText(url);
    const { points, images, title, description } = buildSourceValidPoints(source, url);
    return NextResponse.json({ accessible: true, points, images, title, description, text: source.text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message, accessible: false, status: 'error' }, { status: 500 });
  }
}
