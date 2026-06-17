import { z } from 'zod';

// ============================================================================
// Carpentry Income (read response entity)
// ============================================================================

export const CarpentryIncomeSchema = z.object({
  id: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
  month: z.number(),
  year: z.number(),
  row_number: z.number(),
});
export type CarpentryIncome = z.infer<typeof CarpentryIncomeSchema>;

// ============================================================================
// Carpentry Expense (read response entity)
// ============================================================================

export const CarpentryExpenseSchema = z.object({
  id: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
  month: z.number(),
  year: z.number(),
  is_internal: z.boolean(),
  is_firas: z.boolean(),
  row_number: z.number(),
});
export type CarpentryExpense = z.infer<typeof CarpentryExpenseSchema>;

// ============================================================================
// Monthly Summary
// ============================================================================

export const MonthlySummarySchema = z.object({
  year: z.number(),
  month: z.number(),
  income: z.number(),
  expenses: z.number(),
  internal_expenses: z.number(),
  firas_expenses: z.number(),
});
export type MonthlySummary = z.infer<typeof MonthlySummarySchema>;

// ============================================================================
// Overall Totals
// ============================================================================

export const OverallTotalsSchema = z.object({
  total_income: z.number(),
  total_expenses: z.number(),
  total_internal_expenses: z.number(),
  total_firas_expenses: z.number(),
  net_income: z.number(),
  firas_share: z.number(),
});
export type OverallTotals = z.infer<typeof OverallTotalsSchema>;

// ============================================================================
// Carpentry Data (aggregate response)
// ============================================================================

export const CarpentryDataSchema = z.object({
  income: z.array(CarpentryIncomeSchema),
  expenses: z.array(CarpentryExpenseSchema),
  monthly_summaries: z.array(MonthlySummarySchema),
  overall_totals: OverallTotalsSchema,
});
export type CarpentryData = z.infer<typeof CarpentryDataSchema>;

// ============================================================================
// Add Carpentry Income
// ============================================================================

export const AddCarpentryIncomeRequestSchema = z.object({
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type AddCarpentryIncomeRequest = z.infer<typeof AddCarpentryIncomeRequestSchema>;

// ============================================================================
// Update Carpentry Income
// ============================================================================

export const UpdateCarpentryIncomeRequestSchema = z.object({
  row_number: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type UpdateCarpentryIncomeRequest = z.infer<typeof UpdateCarpentryIncomeRequestSchema>;

// ============================================================================
// Add Carpentry Expense
// ============================================================================

export const AddCarpentryExpenseRequestSchema = z.object({
  amount: z.number(),
  description: z.string(),
  date: z.string(),
  is_internal: z.boolean().optional(),
  is_firas: z.boolean().optional(),
});
export type AddCarpentryExpenseRequest = z.infer<typeof AddCarpentryExpenseRequestSchema>;

// ============================================================================
// Update Carpentry Expense
// ============================================================================

export const UpdateCarpentryExpenseRequestSchema = z.object({
  row_number: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
  is_internal: z.boolean().optional(),
});
export type UpdateCarpentryExpenseRequest = z.infer<typeof UpdateCarpentryExpenseRequestSchema>;

// ============================================================================
// Delete Carpentry (income or expense)
// ============================================================================

export const DeleteCarpentryRequestSchema = z.object({
  row_number: z.number(),
});
export type DeleteCarpentryRequest = z.infer<typeof DeleteCarpentryRequestSchema>;
