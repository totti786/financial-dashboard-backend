import { z } from 'zod';

// ============================================================================
// Success / Error Responses
// ============================================================================

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Paginated Response
// ============================================================================

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.boolean(),
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    per_page: z.number(),
  });
}

// ============================================================================
// Data Version
// ============================================================================

export const DataVersionSchema = z.object({
  version: z.number(),
  last_sync: z.string().nullable(),
});
export type DataVersion = z.infer<typeof DataVersionSchema>;

// ============================================================================
// Health
// ============================================================================

export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  database: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ============================================================================
// Sync Status
// ============================================================================

export const SyncStatusSchema = z.enum(['idle', 'running', 'success', 'error']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const SyncStatusResponseSchema = z.object({
  status: SyncStatusSchema,
  last_sync: z.string().nullable(),
  error: z.string().nullable(),
});
export type SyncStatusResponse = z.infer<typeof SyncStatusResponseSchema>;
