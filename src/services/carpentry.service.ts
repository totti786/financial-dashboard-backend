// ============================================================================
// Carpentry Service — business logic for carpentry income & expense management
// ============================================================================

import { getDb } from '../db/index.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CarpentryIncomeRecord {
  id: number;
  amount: number;
  description: string;
  date: string;
  month: number;
  year: number;
  row_number: number;
}

export interface CarpentryExpenseRecord {
  id: number;
  amount: number;
  description: string;
  date: string;
  month: number;
  year: number;
  is_internal: boolean;
  is_firas: boolean;
  row_number: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expenses: number;
  internal_expenses: number;
  firas_expenses: number;
}

export interface OverallTotals {
  total_income: number;
  total_expenses: number;
  total_internal_expenses: number;
  total_firas_expenses: number;
  net_income: number;
  firas_share: number;
}

export interface CarpentryData {
  income: CarpentryIncomeRecord[];
  expenses: CarpentryExpenseRecord[];
  monthly_summaries: MonthlySummary[];
  overall_totals: OverallTotals;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[$,\s]/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function extractMonthYear(dateStr: string): { month: number; year: number } {
  const d = new Date(dateStr);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

// ── DB helpers for row_number auto-assignment ─────────────────────────────

function nextIncomeRowNumber(): number {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(MAX(row_number), 0) + 1 AS next FROM carpentry_income').get() as { next: number };
  return row.next;
}

function nextExpenseRowNumber(): number {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(MAX(row_number), 0) + 1 AS next FROM carpentry_expenses').get() as { next: number };
  return row.next;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function getCarpentryData(): CarpentryData {
  const db = getDb();

  // Fetch all income records
  const incomeRows = db.prepare(
    'SELECT id, amount, description, date, month, year, row_number FROM carpentry_income ORDER BY date DESC, id DESC',
  ).all() as Array<{
    id: number;
    amount: number;
    description: string;
    date: string;
    month: number | null;
    year: number | null;
    row_number: number | null;
  }>;

  // Fetch all expense records
  const expenseRows = db.prepare(
    `SELECT id, amount, description, date, month, year, is_internal, is_firas, row_number
     FROM carpentry_expenses ORDER BY date DESC, id DESC`,
  ).all() as Array<{
    id: number;
    amount: number;
    description: string;
    date: string;
    month: number | null;
    year: number | null;
    is_internal: number;
    is_firas: number;
    row_number: number | null;
  }>;

  // Build income records
  const income: CarpentryIncomeRecord[] = incomeRows.map((r) => ({
    id: r.id,
    amount: parseAmount(r.amount),
    description: r.description ?? '',
    date: r.date ?? '',
    month: r.month ?? 0,
    year: r.year ?? 0,
    row_number: r.row_number ?? 0,
  }));

  // Build expense records
  const expenses: CarpentryExpenseRecord[] = expenseRows.map((r) => ({
    id: r.id,
    amount: parseAmount(r.amount),
    description: r.description ?? '',
    date: r.date ?? '',
    month: r.month ?? 0,
    year: r.year ?? 0,
    is_internal: r.is_internal === 1,
    is_firas: r.is_firas === 1,
    row_number: r.row_number ?? 0,
  }));

  // ── Monthly summaries ──────────────────────────────────────────────────
  const summariesMap = new Map<string, MonthlySummary>();

  for (const inc of income) {
    if (inc.year && inc.month) {
      const key = `${inc.year}-${String(inc.month).padStart(2, '0')}`;
      const existing = summariesMap.get(key) ?? {
        year: inc.year,
        month: inc.month,
        income: 0,
        expenses: 0,
        internal_expenses: 0,
        firas_expenses: 0,
      };
      existing.income += inc.amount;
      summariesMap.set(key, existing);
    }
  }

  for (const exp of expenses) {
    if (exp.year && exp.month) {
      const key = `${exp.year}-${String(exp.month).padStart(2, '0')}`;
      const existing = summariesMap.get(key) ?? {
        year: exp.year,
        month: exp.month,
        income: 0,
        expenses: 0,
        internal_expenses: 0,
        firas_expenses: 0,
      };
      existing.expenses += exp.amount;
      if (exp.is_internal) existing.internal_expenses += exp.amount;
      if (exp.is_firas) existing.firas_expenses += exp.amount;
      summariesMap.set(key, existing);
    }
  }

  const monthly_summaries: MonthlySummary[] = Array.from(summariesMap.values()).sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );

  // ── Overall totals ─────────────────────────────────────────────────────
  const total_income = income.reduce((s, r) => s + r.amount, 0);
  const total_expenses = expenses.reduce((s, r) => s + r.amount, 0);
  const total_internal_expenses = expenses
    .filter((r) => r.is_internal)
    .reduce((s, r) => s + r.amount, 0);
  const total_firas_expenses = expenses
    .filter((r) => r.is_firas)
    .reduce((s, r) => s + r.amount, 0);
  const net_income = total_income - (total_expenses - total_firas_expenses);
  const firas_share = net_income * 0.8;

  return {
    income,
    expenses,
    monthly_summaries,
    overall_totals: {
      total_income,
      total_expenses,
      total_internal_expenses,
      total_firas_expenses,
      net_income,
      firas_share,
    },
  };
}

// ── Income CRUD ─────────────────────────────────────────────────────────────

export function addIncome(
  amount: number,
  description: string,
  date: string,
): CarpentryIncomeRecord {
  const db = getDb();
  const { month, year } = extractMonthYear(date);
  const rowNumber = nextIncomeRowNumber();

  const result = db
    .prepare(
      `INSERT INTO carpentry_income (amount, description, date, month, year, row_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(amount, description, date, month, year, rowNumber);

  return {
    id: Number(result.lastInsertRowid),
    amount,
    description,
    date,
    month,
    year,
    row_number: rowNumber,
  };
}

export function updateIncome(
  row_number: number,
  amount: number,
  description: string,
  date: string,
): CarpentryIncomeRecord {
  const db = getDb();
  const { month, year } = extractMonthYear(date);

  db.prepare(
    `UPDATE carpentry_income SET amount = ?, description = ?, date = ?, month = ?, year = ?, updated_at = datetime('now')
     WHERE row_number = ?`,
  ).run(amount, description, date, month, year, row_number);

  return {
    id: 0,
    amount,
    description,
    date,
    month,
    year,
    row_number,
  };
}

export function deleteIncome(row_number: number): void {
  const db = getDb();
  db.prepare('DELETE FROM carpentry_income WHERE row_number = ?').run(row_number);
}

// ── Expense CRUD ────────────────────────────────────────────────────────────

export function addExpense(
  amount: number,
  description: string,
  date: string,
  is_internal: boolean = false,
  is_firas: boolean = false,
): CarpentryExpenseRecord {
  const db = getDb();
  const { month, year } = extractMonthYear(date);
  const rowNumber = nextExpenseRowNumber();

  const result = db
    .prepare(
      `INSERT INTO carpentry_expenses (amount, description, date, month, year, is_internal, is_firas, row_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(amount, description, date, month, year, is_internal ? 1 : 0, is_firas ? 1 : 0, rowNumber);

  return {
    id: Number(result.lastInsertRowid),
    amount,
    description,
    date,
    month,
    year,
    is_internal,
    is_firas,
    row_number: rowNumber,
  };
}

export function updateExpense(
  row_number: number,
  amount: number,
  description: string,
  date: string,
  is_internal: boolean = false,
): CarpentryExpenseRecord {
  const db = getDb();
  const { month, year } = extractMonthYear(date);

  db.prepare(
    `UPDATE carpentry_expenses SET amount = ?, description = ?, date = ?, month = ?, year = ?, is_internal = ?, updated_at = datetime('now')
     WHERE row_number = ?`,
  ).run(amount, description, date, month, year, is_internal ? 1 : 0, row_number);

  return {
    id: 0,
    amount,
    description,
    date,
    month,
    year,
    is_internal,
    is_firas: false,
    row_number,
  };
}

export function deleteExpense(row_number: number): void {
  const db = getDb();
  db.prepare('DELETE FROM carpentry_expenses WHERE row_number = ?').run(row_number);
}
