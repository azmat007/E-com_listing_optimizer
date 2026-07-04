import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompts, category, platform } = body as { prompts?: string[]; category?: string; platform?: string };
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: 'Missing prompts array.' }, { status: 400 });
    }

    const safePlatform = String(platform || '').trim() || 'amazon';
    const safeCategory = String(category || '').trim() || '';
    const platformHint = {
      amazon: 'professional Amazon product photography, minimal white background, commercial studio look',
      noon: 'clean UAE-friendly product presentation, bright tones, relatable lifestyle',
      carrefour: 'clear basket-friendly product image, high clarity, retail-ready',
      microless: 'accurate electronics product shot, clean packaging context optional',
    }[safePlatform.toLowerCase()] || 'professional e-commerce product photography';

    const urls: string[] = [];
    for (const raw of prompts.slice(0, 5)) {
      const prompt = `${raw}, ${platformHint}${safeCategory ? `, ${safeCategory}` : ''}, high detail, realistic materials, soft ambient light`;
      const encoded = encodeURIComponent(prompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 100000)}&num_inference_steps=28&guidance_scale=6`;
      urls.push(url);
    }

    return NextResponse.json({ urls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
