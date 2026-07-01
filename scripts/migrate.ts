#!/usr/bin/env tsx
/**
 * Migration script: old sandouk.db → new schema
 *
 * Usage: npx tsx scripts/migrate.ts --source ~/Git/dashboard/financial-dashboard/sandouk.db --target ./data/sandouk.db
 *
 * Handles:
 * - TEXT amounts ("$50,000") → REAL numbers (50000.0)
 * - Denormalized rent months (month_1..month_12) → normalized rent_payments table
 * - Preserves user password hashes (scrypt format)
 * - Preserves row_number for backward compatibility
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Parse args
const args = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const targetIdx = args.indexOf('--target');
const skipUsers = args.includes('--skip-users');

if (sourceIdx === -1 || targetIdx === -1) {
  console.error(
    'Usage: npx tsx scripts/migrate.ts --source <old.db> --target <new.db> [--skip-users]'
  );
  process.exit(1);
}

const sourcePath = args[sourceIdx + 1];
const targetPath = args[targetIdx + 1];

// Validate source exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Source database not found: ${sourcePath}`);
  process.exit(1);
}

console.log(`Migrating: ${sourcePath} → ${targetPath}`);

// Ensure target directory exists
const targetDir = path.dirname(targetPath);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Remove target if exists
if (fs.existsSync(targetPath)) {
  fs.unlinkSync(targetPath);
}

// Helper: parse "$50,000" → 50000.0
function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper: parse date string to ISO format
function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Try parsing other formats
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return value; // Return as-is if can't parse
}

// Open source (read-only)
const sourceDb = new Database(sourcePath, { readonly: true });

// Open target
const targetDb = new Database(targetPath);
targetDb.pragma('journal_mode = WAL');
targetDb.pragma('foreign_keys = ON');

// ===== Create target schema =====
console.log('Creating target schema...');
targetDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_income_row ON income(row_number);
  CREATE INDEX IF NOT EXISTS idx_expenses_row ON expenses(row_number);
  CREATE INDEX IF NOT EXISTS idx_tracked_cells_ref ON tracked_cells(cell_reference);
  CREATE INDEX IF NOT EXISTS idx_debts_row ON debts(row_number);
  CREATE INDEX IF NOT EXISTS idx_suppliers_outstanding_name ON suppliers_outstanding(supplier_name);
  CREATE INDEX IF NOT EXISTS idx_suppliers_outstanding_row ON suppliers_outstanding(supplier_name, row_number);
  CREATE INDEX IF NOT EXISTS idx_suppliers_paid_name ON suppliers_paid(supplier_name);
  CREATE INDEX IF NOT EXISTS idx_suppliers_paid_row ON suppliers_paid(supplier_name, row_number);
  CREATE INDEX IF NOT EXISTS idx_rent_name ON rent(rentee_name);
  CREATE INDEX IF NOT EXISTS idx_rent_row ON rent(row_number);
  CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_type ON warehouse_inventory(timber_type);
  CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_row ON warehouse_inventory(row_number);
  CREATE INDEX IF NOT EXISTS idx_carpentry_income_date ON carpentry_income(year, month);
  CREATE INDEX IF NOT EXISTS idx_carpentry_income_row ON carpentry_income(row_number);
  CREATE INDEX IF NOT EXISTS idx_carpentry_expenses_date ON carpentry_expenses(year, month);
  CREATE INDEX IF NOT EXISTS idx_carpentry_expenses_row ON carpentry_expenses(row_number);
  CREATE INDEX IF NOT EXISTS idx_carpentry_expenses_internal ON carpentry_expenses(is_internal);
  CREATE INDEX IF NOT EXISTS idx_carpentry_expenses_firas ON carpentry_expenses(is_firas);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(username);
`);

// Migration counts (skip alembic_version)
const counts: Record<string, number> = {
  users: 0,
  income: 0,
  expenses: 0,
  debts: 0,
  suppliers_outstanding: 0,
  suppliers_paid: 0,
  rent: 0,
  rent_payments: 0,
  warehouse: 0,
  carpentry_income: 0,
  carpentry_expenses: 0,
  monthly_sales: 0,
  tracked_cells: 0,
  audit_log: 0,
};

// ===== Migrate users =====
if (skipUsers) {
  console.log('Skipping users (--skip-users flag set).');
} else {
  console.log('Migrating users...');
  const oldUsers = sourceDb.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
  const insertUser = targetDb.prepare(
    'INSERT INTO users (username, password_hash, permission, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  for (const u of oldUsers) {
    insertUser.run(u.username, u.password_hash, u.permission || 'view', u.created_at, u.updated_at);
    counts.users++;
  }
}

// ===== Migrate income =====
// Old income table does NOT have is_sales or is_sham_cash columns
// Detect from Arabic description text: مبيعات = sales, شام كاش = sham cash
console.log('Migrating income...');
const oldIncome = sourceDb.prepare('SELECT * FROM income').all() as Record<string, unknown>[];
const insertIncome = targetDb.prepare(
  'INSERT INTO income (amount, description, date, row_number, is_sales, is_sham_cash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldIncome) {
  const desc = String(r.description || '');
  const isSales = desc.includes('مبيعات') ? 1 : 0;
  const isShamCash = desc.includes('شام كاش') ? 1 : 0;
  insertIncome.run(
    parseAmount(r.amount as string | number | null),
    r.description,
    parseDate(r.date as string | null),
    r.row_number,
    isSales,
    isShamCash,
    r.created_at,
    r.updated_at,
  );
  counts.income++;
}

// ===== Migrate expenses =====
console.log('Migrating expenses...');
const oldExpenses = sourceDb.prepare('SELECT * FROM expenses').all() as Record<string, unknown>[];
const insertExpense = targetDb.prepare(
  'INSERT INTO expenses (amount, description, date, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
);
for (const r of oldExpenses) {
  insertExpense.run(
    parseAmount(r.amount as string | number | null),
    r.description,
    parseDate(r.date as string | null),
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  counts.expenses++;
}

// ===== Migrate debts =====
console.log('Migrating debts...');
const oldDebts = sourceDb.prepare('SELECT * FROM debts').all() as Record<string, unknown>[];
const insertDebt = targetDb.prepare(
  'INSERT INTO debts (amount, original_amount, description, date, row_number, paid_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldDebts) {
  insertDebt.run(
    parseAmount(r.amount as string | number | null),
    parseAmount(r.original_amount as string | number | null),
    r.description,
    parseDate(r.date as string | null),
    r.row_number,
    parseAmount(r.paid_amount as string | number | null),
    r.created_at,
    r.updated_at,
  );
  counts.debts++;
}

// ===== Migrate suppliers_outstanding =====
console.log('Migrating suppliers_outstanding...');
const oldOutstanding = sourceDb.prepare('SELECT * FROM suppliers_outstanding').all() as Record<string, unknown>[];
const insertOutstanding = targetDb.prepare(
  'INSERT INTO suppliers_outstanding (supplier_name, amount, description, date, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldOutstanding) {
  insertOutstanding.run(
    r.supplier_name,
    parseAmount(r.amount as string | number | null),
    r.description,
    parseDate(r.date as string | null),
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  counts.suppliers_outstanding++;
}

// ===== Migrate suppliers_paid =====
console.log('Migrating suppliers_paid...');
const oldPaid = sourceDb.prepare('SELECT * FROM suppliers_paid').all() as Record<string, unknown>[];
const insertPaid = targetDb.prepare(
  'INSERT INTO suppliers_paid (supplier_name, amount, description, date, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldPaid) {
  insertPaid.run(
    r.supplier_name,
    parseAmount(r.amount as string | number | null),
    r.description,
    parseDate(r.date as string | null),
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  counts.suppliers_paid++;
}

// ===== Migrate rent (with normalization of month columns) =====
console.log('Migrating rent (normalizing month columns)...');
const oldRent = sourceDb.prepare('SELECT * FROM rent').all() as Record<string, unknown>[];
const insertRent = targetDb.prepare(
  'INSERT INTO rent (rentee_name, rent_amount, year, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertRentPayment = targetDb.prepare(
  'INSERT INTO rent_payments (rent_id, year, month, rent_amount, is_paid, is_sham_cash) VALUES (?, ?, ?, ?, ?, ?)'
);

for (const r of oldRent) {
  const result = insertRent.run(
    r.rentee_name,
    parseAmount(r.rent_amount as string | number | null),
    r.year ?? 2026,
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  const rentId = Number(result.lastInsertRowid);

  // Create rent_payments from month_1..month_12 columns
  // is_sham_cash from old rent row applies to all payments
  const isShamCash = (r.is_sham_cash as number) ?? 0;
  for (let m = 1; m <= 12; m++) {
    const key = `month_${m}` as keyof typeof r;
    const isPaid = (r[key] as number) ?? 0;
    insertRentPayment.run(rentId, r.year ?? 2026, m, parseAmount(r.rent_amount as string | number | null), isPaid, isShamCash);
    counts.rent_payments++;
  }
  counts.rent++;
}

// ===== Migrate warehouse_inventory =====
console.log('Migrating warehouse_inventory...');
const oldWarehouse = sourceDb.prepare('SELECT * FROM warehouse_inventory').all() as Record<string, unknown>[];
const insertWarehouse = targetDb.prepare(
  'INSERT INTO warehouse_inventory (timber_type, length, width, thickness, number_of_blanks, volume, value_per_cubic_meter, total_value, grade, location, notes, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldWarehouse) {
  const length = r.length as number;
  const width = r.width as number;
  const thickness = r.thickness as number;
  const numberOfBlanks = (r.number_of_blanks as number) ?? 1;
  const computedVolume = (length * width * thickness * numberOfBlanks) / 1_000_000;

  insertWarehouse.run(
    r.timber_type,
    length,
    width,
    thickness,
    numberOfBlanks,
    (r.volume as number) ?? computedVolume,
    parseAmount(r.value_per_cubic_meter as string | number | null),
    parseAmount(r.total_value as string | number | null),
    r.grade,
    r.location,
    r.notes,
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  counts.warehouse++;
}

// ===== Migrate carpentry_income =====
console.log('Migrating carpentry_income...');
const oldCarpIncome = sourceDb.prepare('SELECT * FROM carpentry_income').all() as Record<string, unknown>[];
const insertCarpIncome = targetDb.prepare(
  'INSERT INTO carpentry_income (amount, description, date, month, year, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldCarpIncome) {
  insertCarpIncome.run(
    parseAmount(r.amount as string | number | null),
    r.description,
    r.date,
    r.month,
    r.year,
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  counts.carpentry_income++;
}

// ===== Migrate carpentry_expenses =====
console.log('Migrating carpentry_expenses...');
const oldCarpExpenses = sourceDb.prepare('SELECT * FROM carpentry_expenses').all() as Record<string, unknown>[];
const insertCarpExpense = targetDb.prepare(
  'INSERT INTO carpentry_expenses (amount, description, date, month, year, is_internal, is_firas, row_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldCarpExpenses) {
  insertCarpExpense.run(
    parseAmount(r.amount as string | number | null),
    r.description,
    r.date,
    r.month,
    r.year,
    r.is_internal ?? 0,
    r.is_firas ?? 0,
    r.row_number,
    r.created_at,
    r.updated_at,
  );
  counts.carpentry_expenses++;
}

// ===== Migrate monthly_sales =====
console.log('Migrating monthly_sales...');
const oldSales = sourceDb.prepare('SELECT * FROM monthly_sales').all() as Record<string, unknown>[];
const insertSales = targetDb.prepare(
  'INSERT INTO monthly_sales (year, month_number, month_name, sales_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
);
for (const r of oldSales) {
  insertSales.run(
    r.year,
    r.month_number,
    r.month_name,
    parseAmount(r.sales_amount as string | number | null),
    r.created_at,
    r.updated_at,
  );
  counts.monthly_sales++;
}

// ===== Migrate tracked_cells =====
console.log('Migrating tracked_cells...');
const oldCells = sourceDb.prepare('SELECT * FROM tracked_cells').all() as Record<string, unknown>[];
const insertCell = targetDb.prepare(
  'INSERT INTO tracked_cells (cell_reference, cell_value, updated_at) VALUES (?, ?, ?)'
);
for (const r of oldCells) {
  insertCell.run(
    r.cell_reference,
    parseAmount(r.cell_value as string | number | null),
    r.updated_at,
  );
  counts.tracked_cells++;
}

// ===== Migrate audit_log =====
console.log('Migrating audit_log...');
const oldAudit = sourceDb.prepare('SELECT * FROM audit_log').all() as Record<string, unknown>[];
const insertAudit = targetDb.prepare(
  'INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
for (const r of oldAudit) {
  insertAudit.run(
    r.user_id,
    r.username,
    r.action,
    r.entity_type,
    r.entity_id,
    r.details,
    r.ip_address,
    r.user_agent,
    r.created_at,
  );
  counts.audit_log++;
}

// Close databases
sourceDb.close();
targetDb.close();

// Print summary
console.log('\n=== Migration Complete ===');
for (const [table, count] of Object.entries(counts)) {
  console.log(`  ${table}: ${count} records`);
}
console.log(`\nNew database: ${targetPath}`);
