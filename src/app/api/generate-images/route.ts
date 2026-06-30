import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompts } = body as { prompts?: string[] };
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: 'Missing prompts array.' }, { status: 400 });
    }

    const urls: string[] = [];
    for (const prompt of prompts.slice(0, 5)) {
      const encoded = encodeURIComponent(prompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
      urls.push(url);
    }

    return NextResponse.json({ urls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
