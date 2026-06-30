import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title } = body as { title?: string };
    if (!title) {
      return NextResponse.json({ data: null, error: 'Missing title.' }, { status: 400 });
    }
    const result = await translateListingAr(title);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}

type ListingResult = { titleAr: string };

async function callGroq(prompt: string): Promise<ListingResult> {
  const apiKey = (process as any)?.env?.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY');
  const { OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  const completion = await openai.chat.completions.create({
    model: 'llama-3.1-70b-versatile',
    temperature: 0.4,
    max_tokens: 2200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: prompt },
    ],
  });
  const raw = completion.choices[0]?.message?.content?.trim() || '{}';
  try {
    const parsed = JSON.parse(raw);
    return {
      titleAr: String(parsed?.titleAr || '').slice(0, 200),
    };
  } catch {
    return { titleAr: '' };
  }
}

function systemPrompt(): string {
  return `You are a professional bilingual e-commerce localizer for Gulf marketplaces.
Output ONLY valid JSON. Example schema:
{"titleAr": "..."}`;
}

async function translateListingAr(input: string): Promise<ListingResult> {
  const prompt = `Translate the product title below to natural Gulf Arabic used in UAE, KSA, and GCC marketplaces. Keep it clear, short, and conversion-optimized. Do NOT keep English words except brand names and model numbers.

English title: ${input}`;
  return callGroq(prompt);
}
