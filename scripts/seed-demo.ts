// ============================================================================
// Demo Data Seed Script
// Creates a demo admin account with realistic financial data for all sections
// Usage: npx tsx scripts/seed-demo.ts
// ============================================================================

import Database from 'better-sqlite3';
import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

// ── Config ──────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DATABASE_PATH || './data/sandouk.db';
const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'demo123';

// ── Helpers ─────────────────────────────────────────────────────────────────
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:16384:8:1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

// ── Main Seed Function ──────────────────────────────────────────────────────
function seed() {
  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log('🌱 Seeding demo data to', DB_PATH);

  // ── Create Tables (if not exist) ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER UNIQUE,
      is_sales INTEGER DEFAULT 0,
      is_sham_cash INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      original_amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER,
      paid_amount REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(description, date, original_amount)
    );

    CREATE TABLE IF NOT EXISTS suppliers_outstanding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(supplier_name, row_number)
    );

    CREATE TABLE IF NOT EXISTS suppliers_paid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      row_number INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(supplier_name, row_number)
    );

    CREATE TABLE IF NOT EXISTS rent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rentee_name TEXT NOT NULL,
      rent_amount REAL DEFAULT 0,
      year INTEGER NOT NULL DEFAULT 2026,
      row_number INTEGER UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS carpentry_income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      month INTEGER,
      year INTEGER,
      row_number INTEGER UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month_number INTEGER NOT NULL,
      month_name TEXT NOT NULL,
      sales_amount REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month_number)
    );

    CREATE TABLE IF NOT EXISTS tracked_cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cell_reference TEXT NOT NULL UNIQUE,
      cell_value REAL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_income_row ON income(row_number);
    CREATE INDEX IF NOT EXISTS idx_expenses_row ON expenses(row_number);
    CREATE INDEX IF NOT EXISTS idx_debts_row ON debts(row_number);
    CREATE INDEX IF NOT EXISTS idx_suppliers_outstanding_name ON suppliers_outstanding(supplier_name);
    CREATE INDEX IF NOT EXISTS idx_suppliers_paid_name ON suppliers_paid(supplier_name);
    CREATE INDEX IF NOT EXISTS idx_rent_name ON rent(rentee_name);
    CREATE INDEX IF NOT EXISTS idx_rent_row ON rent(row_number);
    CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_type ON warehouse_inventory(timber_type);
    CREATE INDEX IF NOT EXISTS idx_carpentry_income_date ON carpentry_income(year, month);
    CREATE INDEX IF NOT EXISTS idx_carpentry_expenses_date ON carpentry_expenses(year, month);
    CREATE INDEX IF NOT EXISTS idx_tracked_cells_ref ON tracked_cells(cell_reference);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
  `);

  // ── Clear existing data ─────────────────────────────────────────────────
  db.exec(`
    DELETE FROM audit_log;
    DELETE FROM tracked_cells;
    DELETE FROM monthly_sales;
    DELETE FROM carpentry_expenses;
    DELETE FROM carpentry_income;
    DELETE FROM warehouse_inventory;
    DELETE FROM rent_payments;
    DELETE FROM rent;
    DELETE FROM suppliers_paid;
    DELETE FROM suppliers_outstanding;
    DELETE FROM debts;
    DELETE FROM expenses;
    DELETE FROM income;
    DELETE FROM users;
  `);

  // ── 1. Demo User ────────────────────────────────────────────────────────
  const passwordHash = hashPassword(DEMO_PASSWORD);
  db.prepare(`
    INSERT INTO users (username, password_hash, permission)
    VALUES (?, ?, ?)
  `).run(DEMO_USERNAME, passwordHash, 'edit');
  console.log('✅ Created demo user:', DEMO_USERNAME);

  // Also create a view-only user
  const viewHash = hashPassword('view123');
  db.prepare(`
    INSERT INTO users (username, password_hash, permission)
    VALUES (?, ?, ?)
  `).run('viewer', viewHash, 'view');
  console.log('✅ Created view-only user: viewer');

  // ── 2. Income Records ───────────────────────────────────────────────────
  // Backend matches sales via: description LIKE '%مبيعات%' OR description = 'شام كاش'
  const incomeDescriptions = [
    'مبيعات نقدي', 'مبيعات بطاقة', 'مبيعات تحويل',
    'استشارة', 'إيراد خدمات', 'مبيعات منتجات',
    'اشتراك شهري', 'عمل حر', 'عمولة',
    'شام كاش'
  ];

  const insertIncome = db.prepare(`
    INSERT INTO income (amount, description, date, row_number, is_sales, is_sham_cash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let row = 1;
  for (let i = 0; i < 25; i++) {
    // Ensure ~60% are sales (مبيعات or شام كاش) so the chart has data
    const desc = i < 15
      ? incomeDescriptions[Math.floor(Math.random() * 4)] // First 4 are مبيعات variants
      : incomeDescriptions[Math.floor(Math.random() * incomeDescriptions.length)];
    const isSales = desc.includes('مبيعات') || desc === 'شام كاش' ? 1 : 0;
    const isShamCash = desc === 'شام كاش' ? 1 : 0;
    insertIncome.run(
      randomAmount(500, 15000),
      desc,
      randomDate(new Date('2026-01-01'), new Date('2026-06-23')),
      row++,
      isSales,
      isShamCash
    );
  }
  console.log('✅ Inserted 25 income records');

  // ── 3. Expense Records ──────────────────────────────────────────────────
  // Include 'شام كاش' so it counts toward sales (backend: description = 'شام كاش')
  const expenseDescriptions = [
    'إيجار', 'مرافق', 'مستلزمات', 'تسويق',
    'تأمين', 'نقل', 'صيانة', 'مستلزمات مكتبية',
    'خدمات مهنية', 'إيجار معدات', 'مصروف شخصي',
    'شام كاش'
  ];

  const insertExpense = db.prepare(`
    INSERT INTO expenses (amount, description, date, row_number)
    VALUES (?, ?, ?, ?)
  `);

  row = 1;
  for (let i = 0; i < 20; i++) {
    // Ensure ~20% are شام كاش expenses so they count toward sales
    const desc = i < 4
      ? 'شام كاش'
      : expenseDescriptions[Math.floor(Math.random() * (expenseDescriptions.length - 1))]; // Exclude شام كاش from random
    insertExpense.run(
      randomAmount(200, 8000),
      desc,
      randomDate(new Date('2026-01-01'), new Date('2026-06-23')),
      row++
    );
  }
  console.log('✅ Inserted 20 expense records');

  // ── 4. Debts ────────────────────────────────────────────────────────────
  const debtDescriptions = [
    'Bank Loan', 'Supplier Credit', 'Equipment Financing',
    'Business Line of Credit', 'Vehicle Loan', 'Inventory Financing'
  ];

  const insertDebt = db.prepare(`
    INSERT INTO debts (amount, original_amount, description, date, row_number, paid_amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 8; i++) {
    const original = randomAmount(5000, 50000);
    const paid = randomAmount(0, original * 0.6);
    const remaining = original - paid;
    insertDebt.run(
      remaining,
      original,
      debtDescriptions[Math.floor(Math.random() * debtDescriptions.length)],
      randomDate(new Date('2025-06-01'), new Date('2026-03-01')),
      i + 1,
      paid
    );
  }
  console.log('✅ Inserted 8 debts');

  // ── 5. Suppliers ────────────────────────────────────────────────────────
  // Must match the frontend allowlist in SupplierContext.tsx
  const supplierNames = [
    'محمود رمضان', 'سمير غبشة', 'ابو يامن بطل',
    'تامر الخطيب', 'حسان الجاجة'
  ];

  const insertSupplierOutstanding = db.prepare(`
    INSERT INTO suppliers_outstanding (supplier_name, amount, description, date, row_number)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSupplierPaid = db.prepare(`
    INSERT INTO suppliers_paid (supplier_name, amount, description, date, row_number)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const supplier of supplierNames) {
    // Outstanding records
    for (let i = 0; i < 3; i++) {
      insertSupplierOutstanding.run(
        supplier,
        randomAmount(1000, 20000),
        `Order #${1000 + i}`,
        randomDate(new Date('2026-01-01'), new Date('2026-06-01')),
        i + 1
      );
    }
    // Paid records
    for (let i = 0; i < 2; i++) {
      insertSupplierPaid.run(
        supplier,
        randomAmount(500, 15000),
        `Payment for Order #${1000 + i}`,
        randomDate(new Date('2026-01-15'), new Date('2026-06-15')),
        i + 1
      );
    }
  }
  console.log('✅ Inserted supplier data for 5 suppliers');

  // ── 6. Other Entities (specific Arabic names) ───────────────────────────
  const otherNames = ['نضال دشلي', 'كمال دشلي', 'سامر دشلي', 'ندوى دشلي', 'محمد غزال'];

  for (const name of otherNames) {
    for (let i = 0; i < 2; i++) {
      insertSupplierOutstanding.run(
        name,
        randomAmount(2000, 30000),
        `Transaction ${i + 1}`,
        randomDate(new Date('2026-01-01'), new Date('2026-06-01')),
        i + 100 + otherNames.indexOf(name) * 10
      );
    }
    insertSupplierPaid.run(
      name,
      randomAmount(1000, 20000),
      'Partial payment',
      randomDate(new Date('2026-02-01'), new Date('2026-06-01')),
      100 + otherNames.indexOf(name) * 10
    );
  }
  console.log('✅ Inserted other entity data for 5 entities');

  // ── 7. Rent ─────────────────────────────────────────────────────────────
  const rentees = [
    { name: 'Ahmad Store', amount: 2500 },
    { name: 'Sara Boutique', amount: 3000 },
    { name: 'Omar Office', amount: 1800 },
    { name: 'Layla Shop', amount: 2200 },
  ];

  const insertRent = db.prepare(`
    INSERT INTO rent (rentee_name, rent_amount, year, row_number)
    VALUES (?, ?, ?, ?)
  `);

  const insertRentPayment = db.prepare(`
    INSERT INTO rent_payments (rent_id, year, month, rent_amount, is_paid, is_sham_cash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < rentees.length; i++) {
    const rentee = rentees[i];
    const result = insertRent.run(rentee.name, rentee.amount, 2026, i + 1);
    const rentId = Number(result.lastInsertRowid);

    // Create monthly payments (Jan-Jun 2026)
    for (let month = 1; month <= 6; month++) {
      const isPaid = month <= 4 ? 1 : (Math.random() > 0.5 ? 1 : 0);
      const isShamCash = isPaid && Math.random() > 0.7 ? 1 : 0;
      insertRentPayment.run(rentId, 2026, month, rentee.amount, isPaid, isShamCash);
    }
  }
  console.log('✅ Inserted rent data for 4 rentees with monthly payments');

  // ── 8. Warehouse Inventory ──────────────────────────────────────────────
  const timberTypes = [
    'Oak', 'Pine', 'Walnut', 'Maple', 'Cherry',
    'Mahogany', 'Birch', 'Cedar', 'Teak', 'Ash'
  ];

  const grades = ['A', 'B', 'C', 'Premium', 'Standard'];
  const locations = ['Warehouse A', 'Warehouse B', 'Yard C', 'Storage D'];

  const insertWarehouse = db.prepare(`
    INSERT INTO warehouse_inventory (timber_type, length, width, thickness, number_of_blanks, volume, value_per_cubic_meter, total_value, grade, location, notes, row_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 15; i++) {
    const length = randomAmount(2, 6);
    const width = randomAmount(0.1, 0.5);
    const thickness = randomAmount(0.02, 0.1);
    const blanks = Math.floor(Math.random() * 50) + 1;
    const volume = Math.round(length * width * thickness * blanks * 1000) / 1000;
    const valuePerM3 = randomAmount(200, 1500);
    const totalValue = Math.round(volume * valuePerM3 * 100) / 100;

    insertWarehouse.run(
      timberTypes[Math.floor(Math.random() * timberTypes.length)],
      length, width, thickness, blanks, volume,
      valuePerM3, totalValue,
      grades[Math.floor(Math.random() * grades.length)],
      locations[Math.floor(Math.random() * locations.length)],
      i % 3 === 0 ? 'Good condition' : null,
      i + 1
    );
  }
  console.log('✅ Inserted 15 warehouse inventory items');

  // ── 9. Carpentry Income ─────────────────────────────────────────────────
  const carpentryIncomeDesc = [
    'Custom Cabinet', 'Door Installation', 'Furniture Repair',
    'Shelving Unit', 'Deck Building', 'Window Frame',
    'Kitchen Renovation', 'Closet System'
  ];

  const insertCarpentryIncome = db.prepare(`
    INSERT INTO carpentry_income (amount, description, date, month, year, row_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 12; i++) {
    const month = (i % 6) + 1;
    insertCarpentryIncome.run(
      randomAmount(1000, 12000),
      carpentryIncomeDesc[Math.floor(Math.random() * carpentryIncomeDesc.length)],
      randomDate(new Date(`2026-${String(month).padStart(2, '0')}-01`), new Date(`2026-${String(month).padStart(2, '0')}-28`)),
      month, 2026,
      i + 1
    );
  }
  console.log('✅ Inserted 12 carpentry income records');

  // ── 10. Carpentry Expenses ──────────────────────────────────────────────
  const carpentryExpenseDesc = [
    'Wood Purchase', 'Hardware', 'Finishing Materials',
    'Tool Maintenance', 'Labor Cost', 'Transport',
    'Firas Commission', 'Internal Materials'
  ];

  const insertCarpentryExpense = db.prepare(`
    INSERT INTO carpentry_expenses (amount, description, date, month, year, is_internal, is_firas, row_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 15; i++) {
    const month = (i % 6) + 1;
    const isInternal = Math.random() > 0.6 ? 1 : 0;
    const isFiras = !isInternal && Math.random() > 0.5 ? 1 : 0;
    insertCarpentryExpense.run(
      randomAmount(200, 5000),
      carpentryExpenseDesc[Math.floor(Math.random() * carpentryExpenseDesc.length)],
      randomDate(new Date(`2026-${String(month).padStart(2, '0')}-01`), new Date(`2026-${String(month).padStart(2, '0')}-28`)),
      month, 2026,
      isInternal, isFiras,
      i + 1
    );
  }
  console.log('✅ Inserted 15 carpentry expense records');

  // ── 11. Monthly Sales ───────────────────────────────────────────────────
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June'];
  const insertMonthlySales = db.prepare(`
    INSERT INTO monthly_sales (year, month_number, month_name, sales_amount)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < monthNames.length; i++) {
    insertMonthlySales.run(2026, i + 1, monthNames[i], randomAmount(20000, 80000));
  }
  // Also add 2025 data
  for (let i = 0; i < 12; i++) {
    const monthNames2025 = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    insertMonthlySales.run(2025, i + 1, monthNames2025[i], randomAmount(15000, 70000));
  }
  console.log('✅ Inserted monthly sales data (2025-2026)');

  // ── 12. Tracked Cells ──────────────────────────────────────────────────
  const insertTrackedCell = db.prepare(`
    INSERT INTO tracked_cells (cell_reference, cell_value)
    VALUES (?, ?)
  `);

  insertTrackedCell.run('I12', randomAmount(50000, 150000));
  insertTrackedCell.run('K12', randomAmount(30000, 100000));
  insertTrackedCell.run('I18', randomAmount(20000, 80000));
  console.log('✅ Inserted 3 tracked cells');

  // ── 13. Audit Log ──────────────────────────────────────────────────────
  const insertAudit = db.prepare(`
    INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const auditActions = [
    { action: 'create', entity: 'income', details: 'Added new income record' },
    { action: 'update', entity: 'expense', details: 'Updated expense amount' },
    { action: 'delete', entity: 'debt', details: 'Removed paid debt' },
    { action: 'create', entity: 'supplier', details: 'Added supplier transaction' },
    { action: 'login', entity: 'user', details: 'User logged in' },
  ];

  for (let i = 0; i < 10; i++) {
    const audit = auditActions[i % auditActions.length];
    insertAudit.run(
      1, DEMO_USERNAME,
      audit.action, audit.entity,
      String(Math.floor(Math.random() * 100) + 1),
      audit.details,
      '127.0.0.1',
      randomDate(new Date('2026-06-01'), new Date('2026-06-23'))
    );
  }
  console.log('✅ Inserted 10 audit log entries');

  // ── Done ────────────────────────────────────────────────────────────────
  db.close();
  console.log('\n🎉 Demo data seeded successfully!');
  console.log(`\n📋 Demo Credentials:`);
  console.log(`   Username: ${DEMO_USERNAME}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log(`   Permission: edit (full access)`);
  console.log(`\n   Username: viewer`);
  console.log(`   Password: view123`);
  console.log(`   Permission: view (read-only)`);
}

seed();
