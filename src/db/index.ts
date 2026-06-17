// Database connection — better-sqlite3 singleton + Drizzle ORM
// Used by auth (raw) and all business services (Drizzle)

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

let _db: Database.Database | null = null;
let _drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDbPath(): string {
  return process.env.DATABASE_PATH || './data/sandouk.db';
}

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Ensure users table exists (mirrors old Flask schema)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return _db;
}

/** Drizzle ORM instance — used by all business services */
export function getDrizzleDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_drizzleDb) return _drizzleDb;
  const sqlite = getDb();
  _drizzleDb = drizzle(sqlite, { schema });
  return _drizzleDb;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ── User queries ──────────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  permission: string;
  created_at: string;
  updated_at: string;
}

export function getUserByUsername(username: string): UserRow | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as UserRow | undefined;
  return row;
}

export function getUserById(id: number): UserRow | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
  return row;
}

export function createUser(
  username: string,
  passwordHash: string,
  permission: string,
): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO users (username, password_hash, permission, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
  );
  const result = stmt.run(username, passwordHash, permission);
  return Number(result.lastInsertRowid);
}

export function getAllUsers(): UserRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT id, username, permission, created_at, updated_at FROM users ORDER BY username',
    )
    .all() as UserRow[];
  return rows;
}
