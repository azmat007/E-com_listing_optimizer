import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fetchSourceText } from '@/lib/source-extractor';

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
}: {
  productName: string;
  features: string;
  category: string;
}): ListingResult {
  const safeCategory = category || 'General';
  const featureList = (features || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const primaryFeature = featureList[0] || 'premium quality';

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
      `إعداد سهل وتصميم موجه للعملاء.`,
      `موثوق من قبل المحترفين والمستخدمين المنزليين على حد سواء.`,
    ],
    description: `The ${productName} is a versatile ${safeCategory.toLowerCase()} option designed around the features that matter most: ${features}. It focuses on practical usability, consistent results, and straightforward setup, making it well-suited for both professional and everyday use.`,
    descriptionAr: `${productName} هو خيار ${safeCategory.toLowerCase()} متعدد الأغراض مصمم حول الميزات الأساسية، بما في ذلك ${primaryFeature}. يركز هذا المنتج على الفائدة العملية والنتائج المتسقة والإعداد البسيط، مما يجعله مثالياً للاستخدام المهني واليومي على حد سواء.`,
    keywords: [productName, safeCategory, 'UAE', 'Saudi', 'Gulf', ...featureList.slice(0, 3)],
    keywordsAr: [productName, safeCategory, 'الإمارات', 'السعودية', 'الخليج', ...featureList.slice(0, 3)],
    imagePrompts: {
      main: `${productName} on pure white background, professional product photography, studio lighting, sharp focus, no people, no text, no watermark, e-commerce main image`,
      secondary: [
        `${productName} in everyday home setting, natural window light, lifestyle scene, relatable usage, no text overlay`,
        `${productName} close-up detail photography, texture and build quality emphasis, macro lighting`,
        `${productName} real-world action use in UAE home, candid feel, ambient lighting, clean background`,
        `${productName} clean studio angle shot with soft shadows, premium commercial product photography`,
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
  return `${knowledgeNote}You are a senior e-commerce conversion copywriter for ${platform}.

Creative rules:
- State concrete buyer outcomes, not vague claims like "premium", "superb", "best ever".
- Every bullet must pass: claim → proof — if it cannot be tied to provided source notes, remove it.
- Sort bullets by buyer priority: problem solved first, performance second, convenience third, durability fourth, extras fifth.
- If the source notes contain specs, keep them exact; do not round or rename measurements.
- Use platform-specific language from the knowledge file when it conflicts with generic advice.

Formatting rules:
- Generate: title, bullets, description, keywords, and imagePrompts.
- Do not prepend Brand to title unless the product is branded.
- Avoid marketing filler entirely.

Output ONLY valid JSON.`;
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
  const sourceNote = sourceContext
    ? `Source product page notes:\n${sourceContext.slice(0, 5000)}\n`
    : '';

  return `Product: ${productName}
Category: ${category}
Features: ${features}
Platform: ${platform}

${sourceNote}Rewrite this into a higher-converting bilingual listing.
- Improve the title and bullets to sell outcomes, not just features.
- Keep Arabic natural for Gulf buyers.
- Use the source notes above as truth constraints.`;
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
    const sourceTitle = sourceContext.title || '';
    const sourceFeatures = sourceContext.features || '';
    const sourceNotes = sourceContext.text || '';
    const userPrompt = getUserPrompt({
      productName,
      features,
      category,
      platform: normalizedPlatform,
      sourceContext: [sourceTitle, sourceFeatures, sourceNotes].filter(Boolean).join('\n'),
    });

    if (!groq) {
      const fallback = buildListing({ productName, features, category });
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
