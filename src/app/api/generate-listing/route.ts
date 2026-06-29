import { NextResponse } from 'next/server';

type ListingResult = { title: string; bullets: string[]; description: string };

function buildListing({
  productName,
  features,
  category,
  sourceContext = '',
}: {
  productName: string;
  features: string;
  category: string;
  sourceContext?: string;
}): ListingResult {
  const safeCategory = category || 'General';
  return {
    title: `${productName} — ${safeCategory} Edition`,
    bullets: [
      `Premium ${safeCategory.toLowerCase()} experience tailored for real use.`,
      `Built-in essentials: ${(features || '').split(',')[0].trim()}.`,
      `Reliable performance with consistent daily results.`,
      `Easy setup and customer-oriented design.`,
      `Trusted by professionals and home users alike.`,
    ],
    description: `The ${productName} is a versatile ${safeCategory.toLowerCase()} option designed around the features that matter most: ${features}.${
      sourceContext
        ? ' Drawing on marketplace reference material, it aligns with what buyers already expect from comparable listings.'
        : ''
    } It focuses on practical usability, consistent results, and straightforward setup, making it well-suited for both professional and everyday use.`,
  };
}

async function fetchSourceText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const init: RequestInit = {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: 'text/html,application/xhtml+xml',
      },
    };
    const res = await fetch(url, init);
    clearTimeout(timeout);
    if (!res.ok) {
      return '';
    }
    const html = await res.text();
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped;
  } catch {
    return '';
  }
}

async function getGroqClient() {
  if (!process.env.GROQ_API_KEY) return null;
  try {
    const { OpenAI } = await import('openai');
    return new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productName, features, category, sourceUrl } = body as {
      productName?: string;
      features?: string;
      category?: string;
      sourceUrl?: string;
    };

    if (!productName || !features || !category) {
      return NextResponse.json(
        { error: 'Missing productName, features, or category.' },
        { status: 400 }
      );
    }

    const sourceContext = sourceUrl ? await fetchSourceText(sourceUrl) : '';
    const groq = await getGroqClient();
    if (!groq) {
      return NextResponse.json({ ...buildListing({ productName, features, category, sourceContext }) });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a professional Amazon/Noon e-commerce copywriter. Output ONLY valid JSON: {"title":"string max 200 chars","bullets":["string x5"],"description":"string 100-300 words"}`,
        },
        {
          role: 'user',
          content: `Product: ${productName}\nCategory: ${category}\nFeatures: ${features}\nSource page notes:\n${sourceContext.slice(0, 4000)}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let data: Partial<ListingResult> = {};
    try {
      data = JSON.parse(raw) as Partial<ListingResult>;
    } catch {
      return NextResponse.json({ ...buildListing({ productName, features, category, sourceContext }) });
    }

    const title = (data.title || '').slice(0, 200) || `${productName} — ${category} Edition`;
    const bullets = Array.isArray(data.bullets) ? data.bullets.slice(0, 5).map((b) => `${b}`.trim()) : buildListing({ productName, features, category, sourceContext }).bullets;
    const description = (data.description || '').trim() || buildListing({ productName, features, category, sourceContext }).description;

    return NextResponse.json({ title, bullets, description });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
