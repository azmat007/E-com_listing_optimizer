import { NextResponse } from 'next/server';
import { fetchSourceText, buildSourceValidPoints } from '@/lib/source-extractor';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body as { url?: string };
    if (!url || !url.trim()) return NextResponse.json({ error: 'Missing url.' }, { status: 400 });

    let source: { text: string; images: string[]; title?: string; features?: string };
    try {
      source = await fetchSourceText(url);
    } catch {
      source = { text: '', images: [], title: undefined, features: undefined };
    }

    const text = (source.text || '').slice(0, 7000);
    const hasUsableContent = Boolean(source.title || source.features || text.trim());

    let status: 'verified' | 'unverified' | 'inaccessible' = 'verified';
    const notableErrors: string[] = [];

    if (!text && !source.images.length) {
      status = 'inaccessible';
      notableErrors.push('No content loaded from the provided link. The page may block automated access or is unavailable.');
    }

    if (/^https:\/\/[^/]+\.amazon\.(?:\w+)\.?\/|^https:\/\/www\.amazon\.(?:\w+)\.?/.test(url)) {
      const t = source.text || '';
      if (/Enter\s*mobile\s*number|OTP|captcha|Enter the characters/i.test(t)) {
        status = 'inaccessible';
        notableErrors.push('Amazon returned a challenge page: phone/OTP/CAPTCHA verification required.');
      }
    }

    return NextResponse.json({
      status,
      accessible: status !== 'inaccessible',
      verified: hasUsableContent || status === 'verified',
      title,
      description,
      points: notableErrors.length ? [...points, ...notableErrors] : points,
      images,
      text,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message, status: 'inaccessible', accessible: false, verified: false }, { status: 200 });
  }
}