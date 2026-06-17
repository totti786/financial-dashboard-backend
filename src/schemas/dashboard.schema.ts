import { z } from 'zod';

// ============================================================================
// Daily Sale
// ============================================================================

export const DailySaleSchema = z.object({
  day: z.string(),
  amount: z.number(),
  date: z.string(),
});
export type DailySale = z.infer<typeof DailySaleSchema>;

// ============================================================================
// Dashboard Data (aggregate financial summary)
// ============================================================================

export const DashboardDataSchema = z.object({
  total_income: z.number(),
  total_sales: z.number(),
  other_business_income: z.number(),
  carpentry_business_expenses: z.number(),
  house_fund: z.number(),
  rentals: z.number(),
  sham_cash_income: z.number(),
  sham_cash_expenses: z.number(),
  net_sham_cash_income: z.number(),
  total_payments: z.number(),
  personal_expenses: z.number(),
  net_income: z.number(),
  total_debts: z.number(),
  daily_sales: z.array(DailySaleSchema),
  total_to_date: z.number(),
  avg_daily: z.number(),
  remaining_days: z.number(),
  projected_total_income: z.number(),
});
export type DashboardData = z.infer<typeof DashboardDataSchema>;

// ============================================================================
// Monthly Sale
// ============================================================================

export const MonthlySaleSchema = z.object({
  month: z.string(),
  amount: z.number(),
  month_index: z.number(),
});
export type MonthlySale = z.infer<typeof MonthlySaleSchema>;

// ============================================================================
// Monthly Sales Response
// ============================================================================

export const MonthlySalesResponseSchema = z.object({
  sales_by_year: z.record(z.string(), z.array(MonthlySaleSchema)),
  available_years: z.array(z.string()),
});
export type MonthlySalesResponse = z.infer<typeof MonthlySalesResponseSchema>;
