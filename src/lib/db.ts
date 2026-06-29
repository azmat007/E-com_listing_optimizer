import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'listings.db');

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT,
        features TEXT,
        category TEXT,
        platform TEXT,
        title TEXT,
        bullets TEXT,
        description TEXT,
        image_urls TEXT,
        image_prompt TEXT,
        recommended_prices TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return db;
}
