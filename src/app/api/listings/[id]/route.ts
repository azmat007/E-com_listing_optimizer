import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest) {
  try {
    const searchId = req.nextUrl.searchParams.get('id');
    const db = getDb();
    const row = searchId
      ? db.prepare('SELECT * FROM listings WHERE id = ?').get(searchId)
      : db.prepare('SELECT * FROM listings ORDER BY created_at DESC LIMIT 1').get();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
