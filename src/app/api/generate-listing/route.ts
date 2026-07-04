import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type ListingResult = {
  title: string;
  titleAr: string;
  bullets: string[];
  bulletsAr: string[];
  description: string;
  descriptionAr: string;
  keywords: string[];
  keywordsAr: string[];
  imagePrompts?: { main: string; secondary: string[] };
};

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
  const featureList = (features || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const primaryFeature = featureList[0] || 'premium quality';
  const sourceSuffix = sourceContext ? ' Drawing on marketplace reference material, it aligns with what buyers already expect from comparable listings.' : '';

  return {
    title: `${productName} — ${safeCategory} Edition`,
    titleAr: `${productName} — نسخة ${safeCategory}`,
    bullets: [
      `Premium ${safeCategory.toLowerCase()} experience tailored for real use with ${primaryFeature}.`,
      `Built-in essentials: ${primaryFeature}.`,
      `Reliable performance with consistent daily results.`,
      `Easy setup and customer-oriented design.`,
      `Trusted by professionals and home users alike.`,
    ],
    bulletsAr: [
      `تجربة ${safeCategory} متميزة مصممة للاستخدام الفعلي مع ${primaryFeature}.`,
      `عناصر أساسية مدمجة: ${primaryFeature}.`,
      `أداء موثوق بنتائج متسقة يومياً.`,
      `إعداد سهل وتصوير موجه للعملاء.`,
      `موثوق من قبل المحترفين والمستخدمين المنزليين على حد سواء.`,
    ],
    description: `The ${productName} is a versatile ${safeCategory.toLowerCase()} option designed around the features that matter most: ${features}.${sourceSuffix} It focuses on practical usability, consistent results, and straightforward setup, making it well-suited for both professional and everyday use.`,
    descriptionAr: `${productName} هو خيار ${safeCategory.toLowerCase()} متعدد الأغراض مصمم حول الميزات الأساسية، بما في ذلك ${primaryFeature}.${sourceContext ? ' مستوحى من المواد المرجعية للمتجر الإلكتروني، مما يجعله يتماشى مع ما يتوقعه المشترون بالفعل من قوائم مماثلة.' : ''} يركز هذا المنتج على الفائدة العملية والنتائج المتسقة والإعداد البسيط، مما يجعله مثالياً للاستخدام المهني واليومي على حد سواء.`,
    keywords: [productName, safeCategory, 'UAE', 'Saudi', 'Gulf', ...featureList.slice(0, 3)],
    keywordsAr: [productName, safeCategory, 'الإمارات', 'السعودية', 'الخليج', ...featureList.slice(0, 3)],
    imagePrompts: {
      main: `${productName} product photo on pure white background, no text, no watermark, 80-90% frame fill`,
      secondary: [
        `${productName} lifestyle shot in UAE home setting, natural light, cozy table`,
        `${productName} close-up detail shot highlighting texture`,
        `${productName} in-use action shot, daily real-world usage`,
        `${productName} clean studio composition angle shot`,
      ],
    },
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
  const knowledgeNote = knowledge ? `Platform knowledge:\n${knowledge}\n\n` : '';
  return `${knowledgeNote}You are a professional e-commerce copywriter for ${platform}.
Rules:
- Return English text in the English fields.
- Return Arabic text in the Arabic fields.
- Do NOT mix English and Arabic in the same field.

Output ONLY valid JSON:
{
  "title": "English title",
  "titleAr": "Arabic title",
  "bullets": ["5 English bullet points"],
  "bulletsAr": ["5 Arabic bullet points"],
  "description": "English description",
  "descriptionAr": "Arabic description",
  "keywords": ["5-10 English GEO keywords"],
  "keywordsAr": ["5-10 Arabic GEO keywords"],
  "imagePrompts": {
    "main": "product on pure white background",
    "secondary": ["4 prompt lines"]
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

async function fetchSourceText(url: string): Promise<{ text: string; images: string[]; title?: string; features?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16000);
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
    const lower = html.toLowerCase();

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
      .slice(0, 25);

    const metaTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';

    const metaDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';

    const featureBlock = text
      .replace(metaTitle, '')
      .replace(metaDesc, '')
      .slice(0, 8000);

    return {
      text: [metaTitle, metaDesc, featureBlock].filter(Boolean).join(' | ').slice(0, 12000),
      images,
      title: metaTitle || undefined,
      features: metaDesc || undefined,
    };
  } catch {
    return { text: '', images: [] };
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
    const { productName, features, category, sourceUrl, platform } = body as {
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

    const sourceContext = sourceUrl ? await fetchSourceText(sourceUrl) : { text: '', images: [] };
    const groq = await getGroqClient();
    const normalizedPlatform = platform || 'amazon';
    const systemPrompt = getSystemPrompt(normalizedPlatform);
    const sourceTitle = (sourceContext as any)?.title || '';
    const sourceFeatures = (sourceContext as any)?.features || '';
    const sourceNotes = sourceContext.text || '';
    const userPrompt = getUserPrompt({
      productName,
      features,
      category,
      platform: normalizedPlatform,
      sourceContext: [sourceTitle, sourceFeatures, sourceNotes].filter(Boolean).join('\n'),
    });

    if (!groq) {
      const fallback = buildListing({ productName, features, category, sourceContext: sourceContext.text });
      return NextResponse.json(fallback);
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2800,
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
      const fallback = buildListing({ productName, features, category });
      return NextResponse.json(fallback);
    }

    const title = (data.title || '').slice(0, 200) || `${productName} — ${category} Edition`;
    const titleAr = (data.titleAr || '').slice(0, 200) || `${productName} — نسخة ${category}`;
    const bullets = Array.isArray(data.bullets) ? data.bullets.slice(0, 5).map((b) => `${b}`.trim()) : buildListing({ productName, features, category }).bullets;
    const bulletsAr = Array.isArray(data.bulletsAr) ? data.bulletsAr.slice(0, 5).map((b) => `${b}`.trim()) : buildListing({ productName, features, category }).bulletsAr;
    const description = (data.description || '').trim() || buildListing({ productName, features, category }).description;
    const descriptionAr = (data.descriptionAr || '').trim() || buildListing({ productName, features, category }).descriptionAr;
    const keywords = Array.isArray(data.keywords) ? data.keywords.slice(0, 10) : buildListing({ productName, features, category }).keywords;
    const keywordsAr = Array.isArray(data.keywordsAr) ? data.keywordsAr.slice(0, 10) : buildListing({ productName, features, category }).keywordsAr;
    const imagePrompts = data.imagePrompts || buildListing({ productName, features, category }).imagePrompts;

    return NextResponse.json({
      title,
      titleAr,
      bullets,
      bulletsAr,
      description,
      descriptionAr,
      keywords,
      keywordsAr,
      imagePrompts,
      sourceImages: sourceContext.images,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
