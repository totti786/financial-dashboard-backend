import { getDrizzleDb } from '../db/index.js';
import {
  income,
  expenses,
  debts,
  carpentryIncome,
  carpentryExpenses,
  rentPayments,
  rent,
  monthlySales,
  trackedCells,
} from '../db/schema.js';
import { eq, and, like, sum, gte, lte, sql } from 'drizzle-orm';
import type { DashboardData, MonthlySalesResponse } from '../schemas/dashboard.schema.js';

const CURRENT_YEAR = new Date().getFullYear();

function currentMonth(): number {
  return new Date().getMonth() + 1;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Carpentry shop income for the given month/year */
function getCarpentryShopIncome(db: ReturnType<typeof getDrizzleDb>, month: number, year: number): number {
  const row = db
    .select({ total: sum(carpentryIncome.amount) })
    .from(carpentryIncome)
    .where(and(eq(carpentryIncome.month, month), eq(carpentryIncome.year, year)))
    .get();
  return Number(row?.total ?? 0);
}

/** Carpentry shop expenses for the given month/year (excludes internal) */
function getCarpentryShopExpenses(db: ReturnType<typeof getDrizzleDb>, month: number, year: number): number {
  const row = db
    .select({ total: sum(carpentryExpenses.amount) })
    .from(carpentryExpenses)
    .where(
      and(
        eq(carpentryExpenses.month, month),
        eq(carpentryExpenses.year, year),
        eq(carpentryExpenses.isInternal, 0),
      ),
    )
    .get();
  return Number(row?.total ?? 0);
}

/** Rent collected for the given month (non-sham-cash) */
function getRentForMonth(db: ReturnType<typeof getDrizzleDb>, month: number): number {
  const row = db
    .select({ total: sum(rent.rentAmount) })
    .from(rent)
    .innerJoin(rentPayments, eq(rent.id, rentPayments.rentId))
    .where(and(eq(rentPayments.month, month), eq(rentPayments.isPaid, 1), eq(rentPayments.isShamCash, 0)))
    .get();
  return Number(row?.total ?? 0);
}

/** Sham cash rent for the given month */
function getShamCashRentForMonth(db: ReturnType<typeof getDrizzleDb>, month: number): number {
  const row = db
    .select({ total: sum(rent.rentAmount) })
    .from(rent)
    .innerJoin(rentPayments, eq(rent.id, rentPayments.rentId))
    .where(and(eq(rentPayments.month, month), eq(rentPayments.isPaid, 1), eq(rentPayments.isShamCash, 1)))
    .get();
  return Number(row?.total ?? 0);
}

/** Get tracked cell value by reference */
function getTrackedCell(db: ReturnType<typeof getDrizzleDb>, ref: string): number {
  const row = db
    .select({ value: trackedCells.cellValue })
    .from(trackedCells)
    .where(eq(trackedCells.cellReference, ref))
    .get();
  return Number(row?.value ?? 0);
}

// ── Daily Sales ─────────────────────────────────────────────────────────────

interface DailySaleEntry {
  day: string;
  amount: number;
  date: string;
}

function calculateDailySales(db: ReturnType<typeof getDrizzleDb>): DailySaleEntry[] {
  // Income with مبيعات or exactly "شام كاش"
  const incomeSales = db
    .select({
      date: income.date,
      amount: income.amount,
      description: income.description,
    })
    .from(income)
    .where(sql`(${like(income.description, '%مبيعات%')} OR ${income.description} = 'شام كاش')`)
    .all();

  // Expenses exactly "شام كاش"
  const expenseSales = db
    .select({
      date: expenses.date,
      amount: expenses.amount,
      description: expenses.description,
    })
    .from(expenses)
    .where(eq(expenses.description, 'شام كاش'))
    .all();

  // Aggregate by date
  const dailyMap = new Map<string, number>();

  for (const r of incomeSales) {
    if (r.date) {
      const key = r.date;
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.amount);
    }
  }
  for (const r of expenseSales) {
    if (r.date) {
      const key = r.date;
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.amount);
    }
  }

  const sorted = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([date, amount]) => {
    let dayLabel = date;
    try {
      const d = new Date(date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dayLabel = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
    } catch { /* keep raw date */ }
    return { day: dayLabel, amount, date };
  });
}

function calculateProjections(dailySales: DailySaleEntry[]) {
  if (dailySales.length === 0) {
    return { total_to_date: 0, avg_daily: 0, remaining_days: 0, projected_total: 0 };
  }

  const totalToDate = dailySales.reduce((s, d) => s + d.amount, 0);
  const daysElapsed = dailySales.length;
  const avgDaily = totalToDate / daysElapsed;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  let remainingDays = 0;
  const current = new Date(today);
  while (current <= lastDay) {
    if (current.getDay() !== 5) { // 5 = Friday (Sunday=0, Monday=1, ..., Friday=5)
      remainingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  const projectedTotal = totalToDate + avgDaily * remainingDays;

  return {
    total_to_date: totalToDate,
    avg_daily: avgDaily,
    remaining_days: Math.max(0, remainingDays),
    projected_total: projectedTotal,
  };
}

// ── Main Dashboard Data ─────────────────────────────────────────────────────

export function getDashboardData(): DashboardData {
  const db = getDrizzleDb();
  const month = currentMonth();
  const year = CURRENT_YEAR;

  // total_income: non-sales, non-sham-cash income + carpentry + rent
  const totalIncomeRow = db
    .select({ total: sum(income.amount) })
    .from(income)
    .where(and(eq(income.isSales, 0), eq(income.isShamCash, 0)))
    .get();
  const baseIncome = Number(totalIncomeRow?.total ?? 0);

  const carpentryShopIncome = getCarpentryShopIncome(db, month, year);
  const rentalsIncome = getRentForMonth(db, month);

  const total_income = baseIncome + carpentryShopIncome + rentalsIncome;

  // total_sales: income with مبيعات or exactly "شام كاش" + expenses exactly "شام كاش"
  const salesIncome = db
    .select({ total: sum(income.amount) })
    .from(income)
    .where(sql`(${like(income.description, '%مبيعات%')} OR ${income.description} = 'شام كاش')`)
    .get();
  const salesExpenses = db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .where(eq(expenses.description, 'شام كاش'))
    .get();
  const total_sales = Number(salesIncome?.total ?? 0) + Number(salesExpenses?.total ?? 0);

  // sham_cash_income
  const shamCashExpenses = db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .where(eq(expenses.description, 'شام كاش'))
    .get();
  const shamCashIncomeRows = db
    .select({ total: sum(income.amount) })
    .from(income)
    .where(like(income.description, '%شام كاش%'))
    .get();
  const shamCashRent = getShamCashRentForMonth(db, month);

  const sham_cash_income =
    Number(shamCashExpenses?.total ?? 0) +
    Number(shamCashIncomeRows?.total ?? 0) +
    shamCashRent;

  // sham_cash_expenses: expenses with "شام كاش" in description but not exact match
  const shamCashExpensesRows = db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .where(and(like(expenses.description, '%شام كاش%'), sql`${expenses.description} != 'شام كاش'`))
    .get();
  const sham_cash_expenses = Number(shamCashExpensesRows?.total ?? 0);

  // total_expenses: all expenses + carpentry expenses - sham cash expenses
  const totalExpensesRow = db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .get();
  const allExpenses = Number(totalExpensesRow?.total ?? 0);
  const carpentryShopExpenses = getCarpentryShopExpenses(db, month, year);
  const total_expenses = allExpenses + carpentryShopExpenses - sham_cash_expenses;

  // net_income
  const net_income = total_income - total_expenses;

  // total_debts
  const totalDebtsRow = db
    .select({ total: sum(debts.amount) })
    .from(debts)
    .get();
  const total_debts = Number(totalDebtsRow?.total ?? 0);

  // house_fund
  const house_fund = getTrackedCell(db, 'I18');

  // personal_expenses (زياد)
  const personalRow = db
    .select({ total: sum(expenses.amount) })
    .from(expenses)
    .where(like(expenses.description, '%زياد%'))
    .get();
  const personal_expenses = Number(personalRow?.total ?? 0);

  // net_sham_cash_income
  const net_sham_cash_income = sham_cash_income - sham_cash_expenses;

  // total_payments = all expenses - sham_cash_expenses
  const total_payments = allExpenses - sham_cash_expenses;

  // daily_sales + projections
  const daily_sales = calculateDailySales(db);
  const projections = calculateProjections(daily_sales);

  // rentals = total rent collected for current month
  const rentals = rentalsIncome + shamCashRent;

  // other_business_income = carpentry income for current month
  const other_business_income = carpentryShopIncome;

  // carpentry_business_expenses = tracked cell K12
  const carpentry_business_expenses = getTrackedCell(db, 'K12');

  return {
    total_income,
    total_sales,
    other_business_income,
    carpentry_business_expenses,
    house_fund,
    rentals,
    sham_cash_income,
    sham_cash_expenses,
    net_sham_cash_income,
    total_payments,
    personal_expenses,
    net_income,
    total_debts,
    daily_sales,
    total_to_date: projections.total_to_date,
    avg_daily: projections.avg_daily,
    remaining_days: projections.remaining_days,
    projected_total_income: projections.projected_total,
  };
}

// ── Monthly Sales ───────────────────────────────────────────────────────────

export function getMonthlySales(): MonthlySalesResponse {
  const db = getDrizzleDb();

  const rows = db
    .select({
      year: monthlySales.year,
      monthNumber: monthlySales.monthNumber,
      monthName: monthlySales.monthName,
      salesAmount: monthlySales.salesAmount,
    })
    .from(monthlySales)
    .orderBy(monthlySales.year, monthlySales.monthNumber)
    .all();

  const salesByYear: Record<string, { month: string; amount: number; month_index: number }[]> = {};
  const yearSet = new Set<string>();

  for (const r of rows) {
    const y = String(r.year);
    yearSet.add(y);
    if (!salesByYear[y]) salesByYear[y] = [];
    salesByYear[y].push({
      month: r.monthName,
      amount: r.salesAmount,
      month_index: r.monthNumber,
    });
  }

  return {
    sales_by_year: salesByYear,
    available_years: [...yearSet].sort(),
  };
}
