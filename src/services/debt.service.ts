import { getDrizzleDb } from '../db/index.js';
import { debts } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DebtRecord {
  id: number;
  amount: number;
  original_amount: number;
  description: string;
  date: string;
  row_number: number;
}

export interface DebtListResponse {
  debts: DebtRecord[];
}

// ── Get All Debts ──────────────────────────────────────────────────────────

export function getDebts(): DebtListResponse {
  const db = getDrizzleDb();

  const rows = db
    .select({
      id: debts.id,
      amount: debts.amount,
      originalAmount: debts.originalAmount,
      description: debts.description,
      date: debts.date,
      rowNumber: debts.rowNumber,
    })
    .from(debts)
    .all();

  return {
    debts: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      original_amount: r.originalAmount,
      description: r.description ?? '',
      date: r.date ?? '',
      row_number: r.rowNumber ?? 0,
    })),
  };
}

// ── Add Debt ────────────────────────────────────────────────────────────────

export function addDebt(amount: number, description: string, date: string): number {
  const db = getDrizzleDb();

  const maxRow = db
    .select({ max: sql<number>`COALESCE(MAX(row_number), 0)` })
    .from(debts)
    .get();
  const nextRow = Number(maxRow?.max ?? 0) + 1;

  db.insert(debts)
    .values({
      amount,
      originalAmount: amount,
      description,
      date,
      rowNumber: nextRow,
      paidAmount: 0,
    })
    .run();

  return nextRow;
}

// ── Update Debt ─────────────────────────────────────────────────────────────

export function updateDebt(
  rowNumber: number,
  amount: number,
  description: string,
  date: string,
): void {
  const db = getDrizzleDb();

  db.update(debts)
    .set({ amount, description, date })
    .where(eq(debts.rowNumber, rowNumber))
    .run();
}

// ── Modify Debt Amount (pay or add) ────────────────────────────────────────

export function modifyDebtAmount(
  rowNumber?: number | null,
  description?: string | null,
  date?: string | null,
  originalAmount?: number | null,
  paymentAmount?: number | null,
): number {
  const db = getDrizzleDb();

  // Find the debt record
  let record: { rowNumber: number; amount: number } | undefined;

  if (rowNumber != null) {
    record = db
      .select({ rowNumber: debts.rowNumber, amount: debts.amount })
      .from(debts)
      .where(eq(debts.rowNumber, rowNumber))
      .get() as { rowNumber: number; amount: number } | undefined;
  }

  if (!record && description != null && date != null && originalAmount != null) {
    record = db
      .select({ rowNumber: debts.rowNumber, amount: debts.amount })
      .from(debts)
      .where(
        and(
          eq(debts.description, description),
          eq(debts.date, date),
          eq(debts.originalAmount, originalAmount),
        ),
      )
      .get() as { rowNumber: number; amount: number } | undefined;
  }

  if (!record) {
    throw new Error('Debt not found');
  }

  const payment = paymentAmount ?? 0;
  const newAmount = Math.max(0, record.amount + payment);

  db.update(debts)
    .set({ amount: newAmount })
    .where(eq(debts.rowNumber, record.rowNumber))
    .run();

  return newAmount;
}

// ── Delete Debt ─────────────────────────────────────────────────────────────

export function deleteDebt(
  rowNumber?: number | null,
  description?: string | null,
  date?: string | null,
  originalAmount?: number | null,
): void {
  const db = getDrizzleDb();

  if (rowNumber != null) {
    db.delete(debts)
      .where(eq(debts.rowNumber, rowNumber))
      .run();
    return;
  }

  if (description != null && date != null && originalAmount != null) {
    db.delete(debts)
      .where(
        and(
          eq(debts.description, description),
          eq(debts.date, date),
          eq(debts.originalAmount, originalAmount),
        ),
      )
      .run();
    return;
  }

  throw new Error('Insufficient criteria to identify debt for deletion');
}
