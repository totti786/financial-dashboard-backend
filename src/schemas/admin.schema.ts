import { z } from 'zod';

// ============================================================================
// Audit Event
// ============================================================================

export const AuditEventSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  username: z.string().nullable(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  details: z.string().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// Admin Config
// ============================================================================

export const AdminConfigSchema = z.object({
  apps_script_api_url: z.string(),
  spreadsheet_id: z.string(),
  main_sheet_name: z.string(),
  debts_sheet_name: z.string(),
  rent_sheet_name: z.string(),
  tracked_cells: z.record(z.string(), z.string()),
  database_path: z.string(),
});
export type AdminConfig = z.infer<typeof AdminConfigSchema>;
