import { z } from 'zod';

// ============================================================================
// SupplierRecord
// Each record may have an owed and/or paid sub-record.
// ============================================================================

const SupplierTransactionSchema = z.object({
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});

export const SupplierRecordSchema = z.object({
  id: z.number(),
  row_number: z.number(),
  owed: SupplierTransactionSchema.optional(),
  paid: SupplierTransactionSchema.optional(),
});
export type SupplierRecord = z.infer<typeof SupplierRecordSchema>;

// ============================================================================
// Supplier
// ============================================================================

export const SupplierSchema = z.object({
  name: z.string(),
  records: z.array(SupplierRecordSchema),
});
export type Supplier = z.infer<typeof SupplierSchema>;

// ============================================================================
// Add Supplier
// ============================================================================

export const AddSupplierRequestSchema = z.object({
  supplier_name: z.string(),
  type: z.enum(['owed', 'paid']),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type AddSupplierRequest = z.infer<typeof AddSupplierRequestSchema>;

// ============================================================================
// Update Supplier
// ============================================================================

export const UpdateSupplierRequestSchema = z.object({
  supplier_name: z.string(),
  row_number: z.number(),
  transaction_type: z.enum(['owed', 'paid']),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type UpdateSupplierRequest = z.infer<typeof UpdateSupplierRequestSchema>;

// ============================================================================
// Delete Supplier
// ============================================================================

export const DeleteSupplierRequestSchema = z.object({
  supplier_name: z.string(),
  row_number: z.number(),
  transaction_type: z.enum(['owed', 'paid']),
});
export type DeleteSupplierRequest = z.infer<typeof DeleteSupplierRequestSchema>;

// ============================================================================
// Other Entity (same shape as Supplier)
// ============================================================================

export const OtherEntitySchema = z.object({
  name: z.string(),
  records: z.array(SupplierRecordSchema),
});
export type OtherEntity = z.infer<typeof OtherEntitySchema>;

// ============================================================================
// Add Other
// ============================================================================

export const AddOtherRequestSchema = z.object({
  name: z.string(),
  type: z.enum(['owed', 'paid']),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type AddOtherRequest = z.infer<typeof AddOtherRequestSchema>;

// ============================================================================
// Update Other
// ============================================================================

export const UpdateOtherRequestSchema = z.object({
  name: z.string(),
  row_number: z.number(),
  transaction_type: z.enum(['owed', 'paid']),
  amount: z.number(),
  description: z.string(),
  date: z.string(),
});
export type UpdateOtherRequest = z.infer<typeof UpdateOtherRequestSchema>;

// ============================================================================
// Delete Other
// ============================================================================

export const DeleteOtherRequestSchema = z.object({
  name: z.string(),
  row_number: z.number(),
  transaction_type: z.enum(['owed', 'paid']),
});
export type DeleteOtherRequest = z.infer<typeof DeleteOtherRequestSchema>;
