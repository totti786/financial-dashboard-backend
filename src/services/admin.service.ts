// ============================================================================
// Admin Service — config, user management, and audit log
// ============================================================================

import { getDb } from '../db/index.js';
import { hashPassword } from './password.service.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AppConfig {
  apps_script_api_url: string;
  spreadsheet_id: string;
  main_sheet_name: string;
  debts_sheet_name: string;
  rent_sheet_name: string;
  tracked_cells: Record<string, string>;
  database_path: string;
}

export interface UserResponse {
  id: number;
  username: string;
  permission: string;
  created_at: string;
}

export interface AuditEventRecord {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditFilters {
  limit?: number;
  offset?: number;
  entity_type?: string;
  action?: string;
  username?: string;
}

// ── Config ─────────────────────────────────────────────────────────────────

const defaultConfig: AppConfig = {
  apps_script_api_url: process.env.APPS_SCRIPT_API_URL || '',
  spreadsheet_id: process.env.SPREADSHEET_ID || '',
  main_sheet_name: process.env.MAIN_SHEET_NAME || 'Raw Data',
  debts_sheet_name: process.env.DEBTS_SHEET_NAME || 'Debts',
  rent_sheet_name: process.env.RENT_SHEET_NAME || 'Rent',
  tracked_cells: {
    I12: 'Carpentry Shop Income',
    K12: 'Carpentry Shop Expenses',
    I18: 'Total Cash',
  },
  database_path: process.env.DATABASE_PATH || './data/sandouk.db',
};

export function getConfig(): AppConfig {
  return { ...defaultConfig };
}

export function updateConfig(config: Partial<AppConfig>): { success: boolean; config: AppConfig } {
  // For now just merge with defaults — actual config storage TBD
  const merged = { ...defaultConfig, ...config };
  return { success: true, config: merged };
}

// ── User Management ─────────────────────────────────────────────────────────

export function getUsers(): UserResponse[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, username, permission, created_at FROM users ORDER BY username')
    .all() as UserResponse[];
  return rows;
}

export function getUserById(id: number): UserResponse | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT id, username, permission, created_at FROM users WHERE id = ?')
    .get(id) as UserResponse | undefined;
  return row;
}

export function updateUser(
  userId: number,
  updates: { username?: string; password?: string; permission?: string },
): { success: boolean; user: UserResponse } {
  const db = getDb();

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (updates.username !== undefined) {
    setClauses.push('username = ?');
    params.push(updates.username);
  }
  if (updates.password !== undefined) {
    setClauses.push('password_hash = ?');
    params.push(hashPassword(updates.password));
  }
  if (updates.permission !== undefined) {
    setClauses.push('permission = ?');
    params.push(updates.permission);
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')");
    params.push(userId);
    db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  }

  const user = getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return { success: true, user };
}

export function deleteUser(userId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// ── Audit Log ──────────────────────────────────────────────────────────────

export function getAuditEvents(filters: AuditFilters = {}): AuditEventRecord[] {
  const db = getDb();
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.entity_type) {
    conditions.push('entity_type = ?');
    params.push(filters.entity_type);
  }
  if (filters.action) {
    conditions.push('action = ?');
    params.push(filters.action);
  }
  if (filters.username) {
    conditions.push('username = ?');
    params.push(filters.username);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT id, user_id, username, action, entity_type, entity_id, details, ip_address, user_agent, created_at
       FROM audit_log
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as AuditEventRecord[];

  return rows;
}
