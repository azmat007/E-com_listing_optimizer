import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type ListingResult = {
  title: string;
  titleAr: string;
  bullets: string[];
  description: string;
  descriptionAr: string;
  keywords: string[];
  keywordsAr: string[];
};

function buildListing({
  productName,
  features,
  category,
  sourceContext = '',
  platform = 'amazon',
}: {
  productName: string;
  features: string;
  category: string;
  sourceContext?: string;
  platform?: string;
}): ListingResult {
  const safeCategory = category || 'General';
  return {
    title: `${productName} — ${safeCategory} Edition`,
    titleAr: `${productName} — نسخة ${safeCategory}`,
    bullets: [
      `Premium ${safeCategory.toLowerCase()} experience tailored for real use.`,
      `Built-in essentials: ${(features || '').split(',')[0].trim()}.`,
      `Reliable performance with consistent daily results.`,
      `Easy setup and customer-oriented design.`,
      `Trusted by professionals and home users alike.`,
    ],
    description: `The ${productName} is a versatile ${safeCategory.toLowerCase()} option designed around the features that matter most: ${features}.${sourceContext ? ' Drawing on marketplace reference material, it aligns with what buyers already expect from comparable listings.' : ''} It focuses on practical usability, consistent results, and straightforward setup, making it well-suited for both professional and everyday use.`,
    descriptionAr: `${productName} هو خيار ${safeCategory.toLowerCase()} متعدد الأغراض مصمم حول الميزات الأكثر أهمية: ${features}. يركز على سهولة الاستخدام والنتائج المتسقة والإعداد البسيط، مما يجعله مناسباً للاستخدام المهني واليومي على حد سواء.`,
    keywords: [productName, safeCategory, 'UAE', 'Saudi', 'Gulf', ...(features || '').split(',').slice(0, 3).map((f) => f.trim())],
    keywordsAr: [productName, safeCategory, 'الإمارات', 'السعودية', 'الخليج', ...(features || '').split(',').slice(0, 3).map((f) => f.trim())],
  };
}

function getPlatformKnowledge(platform: string): string {
  try {
    const filePath = path.join(process.cwd(), 'src/lib/knowledge', `${platform}.md`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {}
  return '';
}

function getSystemPrompt(platform: string): string {
  const knowledge = getPlatformKnowledge(platform);
  return `You are a professional e-commerce copywriter for ${platform}. Use the platform knowledge below when generating listings.

${knowledge}

Output ONLY valid JSON:
{
  "title": "string max 200 chars English",
  "titleAr": "string max 200 chars Arabic (Gulf dialect)",
  "bullets": ["5 bullet points English"],
  "description": "string 100-300 words English",
  "descriptionAr": "string 100-300 words Arabic (Gulf dialect)",
  "keywords": ["5-10 English GEO keywords for UAE/Saudi search"],
  "keywordsAr": ["5-10 Arabic GEO keywords for UAE/Saudi search"],
  "imagePrompts": {
    "main": "product on pure white background, no text, no watermark, 80-90% frame fill",
    "secondary": ["4 prompt lines for lifestyle/detail shots"]
  }
}`;
}

function getUserPrompt({
  productName,
  features,
  category,
  platform,
  sourceContext,
}: {
  productName: string;
  features: string;
  category: string;
  platform: string;
  sourceContext?: string;
}): string {
  return `Product: ${productName}
Category: ${category}
Features: ${features}
Platform: ${platform}
Source page notes: ${(sourceContext || '').slice(0, 4000)}

Generate a bilingual listing optimized for UAE and Saudi Arabian buyers.`;
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
    const {
      productName,
      features,
      category,
      sourceUrl,
      platform,
    } = body as {
      productName?: string;
      features?: string;
      category?: string;
      sourceUrl?: string;
      platform?: string;
    };

    if (!productName || !features || !category) {
      return NextResponse.json(
        { error: 'Missing productName, features, or category.' },
        { status: 400 }
      );
    }

    const sourceContext = sourceUrl ? await fetchSourceText(sourceUrl) : '';
    const groq = await getGroqClient();
    const systemPrompt = getSystemPrompt(platform || 'amazon');
    const userPrompt = getUserPrompt({ productName, features, category, platform: platform || 'amazon', sourceContext });

    if (!groq) {
      const fallback = buildListing({ productName, features, category, sourceContext, platform: platform || 'amazon' });
      return NextResponse.json(fallback);
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let data: Partial<ListingResult> = {};
    try {
      data = JSON.parse(raw) as Partial<ListingResult>;
    } catch {
      const fallback = buildListing({ productName, features, category, sourceContext, platform: platform || 'amazon' });
      return NextResponse.json(fallback);
    }

    const title = (data.title || '').slice(0, 200) || `${productName} — ${category} Edition`;
    const titleAr = (data.titleAr || '').slice(0, 200) || `${productName} — نسخة ${category}`;
    const bullets = Array.isArray(data.bullets) ? data.bullets.slice(0, 5).map((b) => `${b}`.trim()) : buildListing({ productName, features, category, sourceContext }).bullets;
    const description = (data.description || '').trim() || buildListing({ productName, features, category, sourceContext }).description;
    const descriptionAr = (data.descriptionAr || '').trim() || buildListing({ productName, features, category, sourceContext }).descriptionAr;
    const keywords = Array.isArray(data.keywords) ? data.keywords.slice(0, 10) : buildListing({ productName, features, category, sourceContext }).keywords;
    const keywordsAr = Array.isArray(data.keywordsAr) ? data.keywordsAr.slice(0, 10) : buildListing({ productName, features, category, sourceContext }).keywordsAr;

    return NextResponse.json({ title, titleAr, bullets, description, descriptionAr, keywords, keywordsAr });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
