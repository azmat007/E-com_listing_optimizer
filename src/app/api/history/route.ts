import { NextResponse } from 'next/server';
import * as Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'listings.db');

export const dynamic = 'force-dynamic';

function getDb() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  return new Database(DB_PATH);
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM listings ORDER BY created_at DESC LIMIT 200').all();
    const items = rows.map((row: Record<string, unknown>) => ({
      ...row,
      bullets: typeof row.bullets === 'string' ? JSON.parse(row.bullets as string) : [],
      image_urls: typeof row.image_urls === 'string' ? JSON.parse(row.image_urls as string) : [],
      recommended_prices: typeof row.recommended_prices === 'string' ? JSON.parse(row.recommended_prices as string) : {},
    }));
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      productName,
      features,
      category,
      platform,
      title,
      bullets = [],
      description = '',
      imageUrls = [],
      imagePrompt = '',
      recommendedPrices = {},
      source = 'generated',
    } = (body ?? {}) as Record<string, unknown>;

    if (!productName || !title) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO listings (product_name, features, category, platform, title, bullets, description, image_urls, image_prompt, recommended_prices, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      String(productName),
      features != null ? String(features) : '',
      category != null ? String(category) : '',
      platform != null ? String(platform) : 'amazon',
      String(title),
      JSON.stringify(bullets),
      String(description),
      JSON.stringify(imageUrls),
      String(imagePrompt),
      JSON.stringify(recommendedPrices),
      String(source)
    );

    return NextResponse.json({ id: info.lastInsertRowid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
