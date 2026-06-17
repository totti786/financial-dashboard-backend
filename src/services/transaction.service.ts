import { getDrizzleDb } from '../db/index.js';
import { income, expenses, debts, trackedCells } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

// ── House Fund Helpers ──────────────────────────────────────────────────────

const HOUSE_FUND_CELL = 'I18';
const HOUSE_FUND_KEYWORDS = ['صندوق منزل', 'صندوق البيت', 'house fund', 'housefund'];

function isHouseFundDescription(description: string): boolean {
  if (!description) return false;
  const normalized = description.trim().toLowerCase();
  return HOUSE_FUND_KEYWORDS.some((kw) => normalized.includes(kw));
}

function getCurrentHouseFund(db: ReturnType<typeof getDrizzleDb>): number {
  const row = db
    .select({ value: trackedCells.cellValue })
    .from(trackedCells)
    .where(eq(trackedCells.cellReference, HOUSE_FUND_CELL))
    .get();
  return Number(row?.value ?? 0);
}

function adjustHouseFund(db: ReturnType<typeof getDrizzleDb>, delta: number): void {
  if (delta === 0) return;
  const current = getCurrentHouseFund(db);
  const newValue = current + delta;
  const exists = db
    .select({ id: trackedCells.id })
    .from(trackedCells)
    .where(eq(trackedCells.cellReference, HOUSE_FUND_CELL))
    .get();
  if (exists) {
    db.update(trackedCells)
      .set({ cellValue: newValue })
      .where(eq(trackedCells.cellReference, HOUSE_FUND_CELL))
      .run();
  } else {
    db.insert(trackedCells)
      .values({ cellReference: HOUSE_FUND_CELL, cellValue: newValue })
      .run();
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface TransactionRecord {
  id: number;
  amount: number;
  description: string;
  date: string;
  row_number: number;
}

// ── Get All Transactions ────────────────────────────────────────────────────

export function getTransactions(): {
  income: TransactionRecord[];
  expenses: TransactionRecord[];
  debts: TransactionRecord[];
} {
  const db = getDrizzleDb();

  const incomeRows = db
    .select({
      id: income.id,
      amount: income.amount,
      description: income.description,
      date: income.date,
      rowNumber: income.rowNumber,
    })
    .from(income)
    .all();

  const expenseRows = db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      description: expenses.description,
      date: expenses.date,
      rowNumber: expenses.rowNumber,
    })
    .from(expenses)
    .all();

  const debtRows = db
    .select({
      id: debts.id,
      amount: debts.amount,
      description: debts.description,
      date: debts.date,
      rowNumber: debts.rowNumber,
      originalAmount: debts.originalAmount,
    })
    .from(debts)
    .all();

  return {
    income: incomeRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      description: r.description ?? '',
      date: r.date ?? '',
      row_number: r.rowNumber ?? 0,
    })),
    expenses: expenseRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      description: r.description ?? '',
      date: r.date ?? '',
      row_number: r.rowNumber ?? 0,
    })),
    debts: debtRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      original_amount: r.originalAmount,
      description: r.description ?? '',
      date: r.date ?? '',
      row_number: r.rowNumber ?? 0,
    })),
  };
}

// ── Add Transaction ────────────────────────────────────────────────────────

export function addTransaction(
  type: 'income' | 'expense',
  amount: number,
  description: string,
  date: string,
): number {
  const db = getDrizzleDb();
  const table = type === 'income' ? income : expenses;

  const maxRow = db
    .select({ max: sql<number>`COALESCE(MAX(row_number), 0)` })
    .from(table)
    .get();
  const nextRow = Number(maxRow?.max ?? 0) + 1;

  if (type === 'income') {
    db.insert(income)
      .values({
        amount,
        description,
        date,
        rowNumber: nextRow,
        isSales: 0,
        isShamCash: 0,
      })
      .run();
  } else {
    db.insert(expenses)
      .values({
        amount,
        description,
        date,
        rowNumber: nextRow,
      })
      .run();
  }

  if (isHouseFundDescription(description)) {
    const delta = type === 'income' ? -amount : amount;
    adjustHouseFund(db, delta);
  }

  return nextRow;
}

// ── Update Transaction ─────────────────────────────────────────────────────

export function updateTransaction(
  type: 'income' | 'expense',
  rowNumber: number,
  amount: number,
  description: string,
  date: string,
): void {
  const db = getDrizzleDb();
  const table = type === 'income' ? income : expenses;

  const old = db
    .select({
      amount: table.amount,
      description: table.description,
    })
    .from(table)
    .where(eq(table.rowNumber, rowNumber))
    .get();

  db.update(table)
    .set({ amount, description, date })
    .where(eq(table.rowNumber, rowNumber))
    .run();

  let delta = 0;
  if (old && isHouseFundDescription(old.description ?? '')) {
    const oldDelta = type === 'income' ? -(old.amount) : old.amount;
    delta -= oldDelta;
  }
  if (isHouseFundDescription(description)) {
    const newDelta = type === 'income' ? -amount : amount;
    delta += newDelta;
  }
  if (delta !== 0) {
    adjustHouseFund(db, delta);
  }
}

// ── Delete Transaction ─────────────────────────────────────────────────────

export function deleteTransaction(type: 'income' | 'expense', rowNumber: number): void {
  const db = getDrizzleDb();
  const table = type === 'income' ? income : expenses;

  const old = db
    .select({
      amount: table.amount,
      description: table.description,
    })
    .from(table)
    .where(eq(table.rowNumber, rowNumber))
    .get();

  db.delete(table)
    .where(eq(table.rowNumber, rowNumber))
    .run();

  if (old && isHouseFundDescription(old.description ?? '')) {
    const delta = type === 'income' ? old.amount : -old.amount;
    adjustHouseFund(db, delta);
  }
}
