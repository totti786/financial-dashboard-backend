import { z } from 'zod';

// ============================================================================
// Transaction (read response entity)
// ============================================================================

export const TransactionSchema = z.object({
  id: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
  row_number: z.number(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ============================================================================
// Add Transaction
// ============================================================================

export const AddTransactionRequestSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type AddTransactionRequest = z.infer<typeof AddTransactionRequestSchema>;

// ============================================================================
// Update Transaction
// ============================================================================

export const UpdateTransactionRequestSchema = z.object({
  type: z.enum(['income', 'expense']),
  row_number: z.number(),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
  background: z.boolean().optional(),
});
export type UpdateTransactionRequest = z.infer<typeof UpdateTransactionRequestSchema>;

// ============================================================================
// Delete Transaction
// ============================================================================

export const DeleteTransactionRequestSchema = z.object({
  type: z.enum(['income', 'expense']),
  row_number: z.number(),
  background: z.boolean().optional(),
});
export type DeleteTransactionRequest = z.infer<typeof DeleteTransactionRequestSchema>;
