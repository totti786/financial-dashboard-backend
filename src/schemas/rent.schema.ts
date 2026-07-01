import { z } from 'zod';

// ============================================================================
// MonthlyDetail
// ============================================================================

export const MonthlyDetailSchema = z.object({
  month: z.number(),
  is_paid: z.boolean(),
  is_sham_cash: z.boolean(),
});
export type MonthlyDetail = z.infer<typeof MonthlyDetailSchema>;

// ============================================================================
// Rentee (read response entity)
// ============================================================================

export const RenteeSchema = z.object({
  id: z.number(),
  rentee_name: z.string(),
  rent_amount: z.number(),
  monthly_payments: z.array(z.number()),
  monthly_details: z.array(MonthlyDetailSchema),
  sham_cash_payments: z.array(z.number()),
  row_number: z.number(),
});
export type Rentee = z.infer<typeof RenteeSchema>;

// ============================================================================
// Add Rentee
// ============================================================================

export const AddRenteeRequestSchema = z.object({
  rentee_name: z.string(),
  rent_amount: z.number().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});
export type AddRenteeRequest = z.infer<typeof AddRenteeRequestSchema>;

// ============================================================================
// Update Rentee
// ============================================================================

export const UpdateRenteeRequestSchema = z.object({
  row_number: z.number(),
  rentee_name: z.string().optional(),
  rent_amount: z.number().optional(),
});
export type UpdateRenteeRequest = z.infer<typeof UpdateRenteeRequestSchema>;

// ============================================================================
// Update Rent Month
// ============================================================================

export const UpdateRentMonthRequestSchema = z.object({
  row_number: z.number(),
  year: z.number().int().min(2000).max(2100),
  month: z.number(),
  is_paid: z.boolean(),
  is_sham_cash: z.boolean().optional(),
});
export type UpdateRentMonthRequest = z.infer<typeof UpdateRentMonthRequestSchema>;

// ============================================================================
// Delete Rentee
// ============================================================================

export const DeleteRenteeRequestSchema = z.object({
  row_number: z.number(),
});
export type DeleteRenteeRequest = z.infer<typeof DeleteRenteeRequestSchema>;
