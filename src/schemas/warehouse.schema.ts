import { z } from 'zod';

// ============================================================================
// WarehouseItem (read response entity)
// ============================================================================

export const WarehouseItemSchema = z.object({
  id: z.number(),
  timber_type: z.string(),
  length: z.number(),
  width: z.number(),
  thickness: z.number(),
  number_of_blanks: z.number(),
  volume: z.number(),
  value_per_cubic_meter: z.number().nullable(),
  total_value: z.number().nullable(),
  grade: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  row_number: z.number(),
});
export type WarehouseItem = z.infer<typeof WarehouseItemSchema>;

// ============================================================================
// Add Warehouse Item
// ============================================================================

export const AddWarehouseItemRequestSchema = z.object({
  timber_type: z.string(),
  length: z.number(),
  width: z.number(),
  thickness: z.number(),
  number_of_blanks: z.number().optional(),
  value_per_cubic_meter: z.number().optional(),
  grade: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
export type AddWarehouseItemRequest = z.infer<typeof AddWarehouseItemRequestSchema>;

// ============================================================================
// Update Warehouse Item
// ============================================================================

export const UpdateWarehouseItemRequestSchema = z.object({
  row_number: z.number(),
  timber_type: z.string().optional(),
  length: z.number().optional(),
  width: z.number().optional(),
  thickness: z.number().optional(),
  number_of_blanks: z.number().optional(),
  value_per_cubic_meter: z.number().optional(),
  grade: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateWarehouseItemRequest = z.infer<typeof UpdateWarehouseItemRequestSchema>;

// ============================================================================
// Delete Warehouse Item
// ============================================================================

export const DeleteWarehouseItemRequestSchema = z.object({
  row_number: z.number(),
});
export type DeleteWarehouseItemRequest = z.infer<typeof DeleteWarehouseItemRequestSchema>;
