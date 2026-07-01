// ============================================================================
// Test App Factory — creates a Fastify instance with in-memory SQLite database
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';

/**
 * Hash a password using a lower scrypt N value (16384 vs production's 32768)
 * to avoid OpenSSL 3's default 32MB memory limit with N=32768.
 */
export function testHashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function createTestApp(dbPath: string = ':memory:'): Promise<ReturnType<typeof Fastify>> {
  // Set env vars BEFORE any service module is imported (they use module-level getDb() calls)
  process.env.DATABASE_PATH = dbPath;
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-jwt-secret';
  if (!process.env.COOKIE_SECRET) process.env.COOKIE_SECRET = 'test-cookie-secret';
  if (!process.env.ALLOWED_ORIGINS) process.env.ALLOWED_ORIGINS = 'http://localhost:5173';

  // If using a file path, ensure the directory exists
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const app = Fastify({ logger: false });

  // Register plugins
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { secret: 'test-cookie-secret' });

  // ── Dynamic route imports — these trigger getDb() singleton with our env vars ──
  const [
    healthMod,
    authMod,
    dashMod,
    txMod,
    debtMod,
    suppMod,
    otherMod,
    rentMod,
    whMod,
    carpMod,
    adminMod,
    syncMod,
  ] = await Promise.all([
    import('../routes/health.js'),
    import('../routes/auth.routes.js'),
    import('../routes/dashboard.routes.js'),
    import('../routes/transactions.routes.js'),
    import('../routes/debts.routes.js'),
    import('../routes/suppliers.routes.js'),
    import('../routes/other.routes.js'),
    import('../routes/rent.routes.js'),
    import('../routes/warehouse.routes.js'),
    import('../routes/carpentry.routes.js'),
    import('../routes/admin.routes.js'),
    import('../routes/sync.routes.js'),
  ]);

  // Get the DB singleton after imports have triggered its creation
  const { getDb } = await import('../db/index.js');
  const sqlite = getDb();

  // Create all Drizzle-ORM tables (the singleton only creates the `users` table)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER UNIQUE,
      is_sales INTEGER DEFAULT 0,
      is_sham_cash INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      original_amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER,
      paid_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(description, date, original_amount)
    );

    CREATE TABLE IF NOT EXISTS suppliers_outstanding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(supplier_name, row_number)
    );

    CREATE TABLE IF NOT EXISTS suppliers_paid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(supplier_name, row_number)
    );

    CREATE TABLE IF NOT EXISTS rent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rentee_name TEXT NOT NULL,
      rent_amount REAL DEFAULT 0,
      year INTEGER NOT NULL DEFAULT 2026,
      row_number INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rent_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rent_id INTEGER NOT NULL REFERENCES rent(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      rent_amount REAL NOT NULL DEFAULT 0,
      is_paid INTEGER NOT NULL DEFAULT 0,
      is_sham_cash INTEGER NOT NULL DEFAULT 0,
      UNIQUE(rent_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS warehouse_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timber_type TEXT NOT NULL,
      length REAL NOT NULL,
      width REAL NOT NULL,
      thickness REAL NOT NULL,
      number_of_blanks INTEGER NOT NULL DEFAULT 1,
      volume REAL NOT NULL,
      value_per_cubic_meter REAL,
      total_value REAL,
      grade TEXT,
      location TEXT,
      notes TEXT,
      row_number INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS carpentry_income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      month INTEGER,
      year INTEGER,
      row_number INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS carpentry_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      month INTEGER,
      year INTEGER,
      is_internal INTEGER NOT NULL DEFAULT 0,
      is_firas INTEGER NOT NULL DEFAULT 0,
      row_number INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS monthly_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month_number INTEGER NOT NULL,
      month_name TEXT NOT NULL,
      sales_amount REAL NOT NULL,
      finalized_at TEXT,
      finalized_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(year, month_number)
    );

    CREATE TABLE IF NOT EXISTS tracked_cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cell_reference TEXT NOT NULL UNIQUE,
      cell_value REAL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Create the admin user (hash uses lower N=16384 to work within OpenSSL 3's
  // default 32MB scrypt memory limit - production uses N=32768)
  const adminHash = testHashPassword('admin123');
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (username, password_hash, permission, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run('admin', adminHash, 'edit');

  await app.register(healthMod.healthRoutes, { prefix: '/api' });
  await app.register(authMod.authRoutes, { prefix: '/api/auth' });
  await app.register(dashMod.dashboardRoutes, { prefix: '/api' });
  await app.register(txMod.transactionRoutes, { prefix: '/api' });
  await app.register(debtMod.debtRoutes, { prefix: '/api' });
  await app.register(suppMod.supplierRoutes, { prefix: '/api' });
  await app.register(otherMod.otherRoutes, { prefix: '/api' });
  await app.register(rentMod.rentRoutes, { prefix: '/api' });
  await app.register(whMod.warehouseRoutes, { prefix: '/api' });
  await app.register(carpMod.carpentryRoutes, { prefix: '/api/carpentry' });
  await app.register(adminMod.adminRoutes, { prefix: '/api/admin' });
  await app.register(adminMod.userRoutes, { prefix: '/api' });
  await app.register(adminMod.auditRoutes, { prefix: '/api' });
  await app.register(syncMod.syncRoutes, { prefix: '/api/sync' });
  await app.register(syncMod.dataVersionRoutes, { prefix: '/api' });

  // Bump data version after every successful mutation
  const { bumpVersion } = await import('../services/data-version.service.js');
  app.addHook('onResponse', (_request, reply, done) => {
    if (['POST', 'PUT', 'DELETE'].includes(_request.method) && reply.statusCode >= 200 && reply.statusCode < 300) {
      bumpVersion();
    }
    done();
  });

  // Expose the raw DB for test access
  (app as unknown as Record<string, unknown>).db = sqlite;

  return app;
}
