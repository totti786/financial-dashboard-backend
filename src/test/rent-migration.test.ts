import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateMonthlySalesFinalization, migrateRentPaymentsForReportingPeriods } from '../db/index.js';

let db: Database.Database | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('rent payment reporting-period migration', () => {
  it('preserves legacy payments and allows the same month in another year', () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE rent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rentee_name TEXT NOT NULL,
        rent_amount REAL DEFAULT 0,
        year INTEGER NOT NULL,
        row_number INTEGER UNIQUE
      );
      CREATE TABLE rent_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rent_id INTEGER NOT NULL REFERENCES rent(id) ON DELETE CASCADE,
        month INTEGER NOT NULL,
        is_paid INTEGER NOT NULL DEFAULT 0,
        is_sham_cash INTEGER NOT NULL DEFAULT 0,
        UNIQUE(rent_id, month)
      );
      INSERT INTO rent (id, rentee_name, rent_amount, year, row_number)
      VALUES (1, 'Legacy renter', 500, 2026, 1);
      INSERT INTO rent_payments (rent_id, month, is_paid, is_sham_cash)
      VALUES (1, 3, 1, 0);
    `);

    migrateRentPaymentsForReportingPeriods(db);

    const migrated = db.prepare(
      'SELECT year, month, rent_amount, is_paid FROM rent_payments WHERE rent_id = 1',
    ).get() as { year: number; month: number; rent_amount: number; is_paid: number };
    expect(migrated).toEqual({ year: 2026, month: 3, rent_amount: 500, is_paid: 1 });

    expect(() => db!.prepare(`
      INSERT INTO rent_payments (rent_id, year, month, rent_amount, is_paid)
      VALUES (1, 2027, 3, 500, 1)
    `).run()).not.toThrow();
  });
});

describe('monthly sales finalization migration', () => {
  it('adds finalization audit columns without losing imported totals', () => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE monthly_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        month_name TEXT NOT NULL,
        sales_amount REAL NOT NULL,
        UNIQUE(year, month_number)
      );
      INSERT INTO monthly_sales (year, month_number, month_name, sales_amount)
      VALUES (2025, 12, 'December', 900);
    `);

    migrateMonthlySalesFinalization(db);

    const row = db.prepare(
      'SELECT sales_amount, finalized_at, finalized_by FROM monthly_sales',
    ).get() as { sales_amount: number; finalized_at: string | null; finalized_by: string | null };
    expect(row).toEqual({ sales_amount: 900, finalized_at: null, finalized_by: null });
  });
});
