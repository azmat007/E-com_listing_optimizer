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
  const rawCategory = category || 'Electronics';
  const safeCategory = rawCategory;
  const featureList = (features || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  const arCategoryMap: Record<string, string> = {
    'Electronics': 'إلكترونيات',
    'Home & Kitchen': 'المنزل والمطبخ',
    'Fashion': 'أزياء',
    'Beauty & Personal Care': 'الجمال والعناية الشخصية',
    'Sports & Outdoors': 'رياضة و Outdoor',
    'Toys & Games': 'ألعاب',
    'Automotive': 'سيارات',
    'Health & Household': 'صحة ومنزل',
    'Other': 'عام',
  };
  const arCategory = arCategoryMap[rawCategory] || rawCategory;

  return {
    title: `${productName} — ${safeCategory} Edition`,
    titleAr: `${productName} — ${arCategory}`,
    bullets: [
      `Designed around real ${safeCategory.toLowerCase()} use: ${featureList[0] || 'premium build'} for everyday reliability.`,
      `Core specs: ${featureList.slice(0,3).join(', ') || 'premium-grade materials and finish'}.`,
      `Built for consistent results in typical ${safeCategory.toLowerCase()} scenarios with clear trade-offs.`,
      `Setup is straightforward and support-friendly; usable within minutes out of the box.`,
      `Best suited for buyers comparing similar ${safeCategory.toLowerCase()} models by specs and value.`,
    ],
    bulletsAr: [
      `مصمم للاستخدام الفعلي في فئة ${arCategory}: ${featureList[0] || 'جودة عالية'} لموثوقية يومية.`,
      `المواصفات الأساسية: ${featureList.slice(0,3).join('، ') || 'مواد وتشطيب عالي الجودة'}.`,
      `مصمم لنتائج متسقة في سيناريوهات ${arCategory} الشائعة مع توضيح نقاط القصور.`,
      `الإعداد مباشر ودعم مريح؛ قابل للاستخدام في دقائق من الفتح.`,
      `الأفضل لمن يقارن النماذج المماثلة في فئة ${arCategory} حسب المواصفات والقيمة.`,
    ],
    description: `The ${productName} is a ${safeCategory.toLowerCase()} option centered on real-world usability. ${featureList.length ? `It offers: ${features}. ` : ''}It is intended for buyers who prioritize measurable functionality and clear everyday value over generic marketing claims.`,
    descriptionAr: `يعد ${productName} خياراً من فئة ${arCategory} مركّز على الفائدة العملية. ${featureList.length ? `يقدم المواصفات التالية: ${features}. ` : ''}مخصص للمشترين الذين يعطيون الأولوية للوظائف القابلة للقياس والقيمة اليومية الواضحة بدلاً من العبارات التسويقية العامة.`,
    keywords: [productName, safeCategory, 'UAE', 'Saudi', 'Gulf', ...featureList.slice(0, 5)],
    keywordsAr: [productName, arCategory, 'الإمارات', 'السعودية', 'الخليج', ...featureList.slice(0, 5)],
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
  return `${knowledgeNote}You are a senior marketplace conversion copywriter for ${platform}.

Title rules:
- Make it product-specific: attribute + variant + what it means for the buyer.
- Do not use brand stacking unless the product is officially branded.
- Keep it under 200 chars.

Bullets rules:
- Maximum 5 bullets. Each bullet = claim → proof.
- Lead with outcome, then supporting spec.
- If a claim is not supported by source notes or product type, remove it.

Arabic language rules:
- Write natural Gulf Arabic for UAE/SA buyers. Use proper marketplace register.
- Do NOT insert English words into Arabic sentences. No "Electronics", "Footnote", "Super Retina", etc inside Arabic text.
- If a term must appear in English, transliterate to Arabic script only if it is a commonly understood consumer product word; otherwise describe it in Arabic.

Language rules:
- English fields: strict first-letter capitalization only, no all-caps, no promotional phrases like "free shipping", "best seller".
- Arabic fields: right-toidiomatic Gulf Arabic only.

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

    const title = String(data.title || '').slice(0, 200).trim() || `${productName} — ${category} Edition`;
    const titleAr = String(data.titleAr || '').slice(0, 200).trim() || `${productName} — ${category}`;
    const bullets = Array.isArray(data.bullets) ? data.bullets.slice(0, 5).map((b) => typeof b === 'string' ? b.trim() : JSON.stringify(b)).filter(Boolean) : buildListing({ productName, features, category }).bullets;
    const bulletsAr = Array.isArray(data.bulletsAr) ? data.bulletsAr.slice(0, 5).map((b) => typeof b === 'string' ? b.trim() : JSON.stringify(b)).filter(Boolean) : buildListing({ productName, features, category }).bulletsAr;
    const description = typeof data.description === 'string' ? data.description.trim() : buildListing({ productName, features, category }).description;
    const descriptionAr = typeof data.descriptionAr === 'string' ? data.descriptionAr.trim() : buildListing({ productName, features, category }).descriptionAr;
    const keywords = Array.isArray(data.keywords) ? data.keywords.slice(0, 10).map(String) : buildListing({ productName, features, category }).keywords;
    const keywordsAr = Array.isArray(data.keywordsAr) ? data.keywordsAr.slice(0, 10).map(String) : buildListing({ productName, features, category }).keywordsAr;
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
