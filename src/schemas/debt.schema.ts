import { z } from 'zod';

// ============================================================================
// Debt (read response entity)
// ============================================================================

export const DebtSchema = z.object({
  id: z.number(),
  amount: z.number(),
  original_amount: z.number(),
  description: z.string(),
  date: z.string(),
  row_number: z.number(),
});
export type Debt = z.infer<typeof DebtSchema>;

// ============================================================================
// Add Debt
// ============================================================================

export const AddDebtRequestSchema = z.object({
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type AddDebtRequest = z.infer<typeof AddDebtRequestSchema>;

// ============================================================================
// Update Debt
// ============================================================================

export const UpdateDebtRequestSchema = z.object({
  row_number: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type UpdateDebtRequest = z.infer<typeof UpdateDebtRequestSchema>;

// ============================================================================
// Pay Debt
// ============================================================================

export const PayDebtRequestSchema = z.object({
  row_number: z.number().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  original_amount: z.number().optional(),
  payment_amount: z.number(),
});
export type PayDebtRequest = z.infer<typeof PayDebtRequestSchema>;

// ============================================================================
// Delete Debt
// ============================================================================

export const DeleteDebtRequestSchema = z.object({
  row_number: z.number().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  original_amount: z.number().optional(),
});
export type DeleteDebtRequest = z.infer<typeof DeleteDebtRequestSchema>;
