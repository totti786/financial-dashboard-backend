import { getDb } from '../db/index.js';

export interface AuditPayload {
  method: string;
  path: string;
  statusCode: number;
  userId?: number | null;
  username?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  routeParams?: unknown;
  query?: unknown;
  body?: unknown;
}

const REDACT_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'secret',
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 4) return '[depth-limit]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = sanitize(raw, depth + 1);
  }
  return out;
}

function inferAction(path: string, method: string): { action: string; entityType: string } {
  const normalized = path.toLowerCase();
  const verb = method.toUpperCase();

  if (normalized.includes('/auth/login')) return { action: 'login', entityType: 'auth' };
  if (normalized.includes('/auth/logout')) return { action: 'logout', entityType: 'auth' };
  if (normalized.includes('/admin/config')) return { action: 'update', entityType: 'config' };
  if (normalized.includes('/users')) return { action: verb === 'DELETE' ? 'delete' : verb === 'PUT' ? 'update' : 'add', entityType: 'user' };
  if (normalized.includes('/transactions/add')) return { action: 'add', entityType: 'transaction' };
  if (normalized.includes('/transactions/update')) return { action: 'update', entityType: 'transaction' };
  if (normalized.includes('/transactions/delete')) return { action: 'delete', entityType: 'transaction' };
  if (normalized.includes('/debts/pay')) return { action: 'pay', entityType: 'debt' };
  if (normalized.includes('/debts/add')) return { action: 'add', entityType: 'debt' };
  if (normalized.includes('/debts/update')) return { action: 'update', entityType: 'debt' };
  if (normalized.includes('/debts/delete')) return { action: 'delete', entityType: 'debt' };
  if (normalized.includes('/suppliers/add')) return { action: 'add', entityType: 'supplier_transaction' };
  if (normalized.includes('/suppliers/update')) return { action: 'update', entityType: 'supplier_transaction' };
  if (normalized.includes('/suppliers/delete')) return { action: 'delete', entityType: 'supplier_transaction' };
  if (normalized.includes('/other/add')) return { action: 'add', entityType: 'other_transaction' };
  if (normalized.includes('/other/update')) return { action: 'update', entityType: 'other_transaction' };
  if (normalized.includes('/other/delete')) return { action: 'delete', entityType: 'other_transaction' };
  if (normalized.includes('/rent/add')) return { action: 'add', entityType: 'rent' };
  if (normalized.includes('/rent/update')) return { action: 'update', entityType: 'rent' };
  if (normalized.includes('/rent/month')) return { action: 'update', entityType: 'rent_payment' };
  if (normalized.includes('/rent/delete')) return { action: 'delete', entityType: 'rent' };
  if (normalized.includes('/warehouse/add')) return { action: 'add', entityType: 'warehouse' };
  if (normalized.includes('/warehouse/update')) return { action: 'update', entityType: 'warehouse' };
  if (normalized.includes('/warehouse/delete')) return { action: 'delete', entityType: 'warehouse' };
  if (normalized.includes('/carpentry/income/add')) return { action: 'add', entityType: 'carpentry_income' };
  if (normalized.includes('/carpentry/income/update')) return { action: 'update', entityType: 'carpentry_income' };
  if (normalized.includes('/carpentry/income/delete')) return { action: 'delete', entityType: 'carpentry_income' };
  if (normalized.includes('/carpentry/expense/add')) return { action: 'add', entityType: 'carpentry_expense' };
  if (normalized.includes('/carpentry/expense/update')) return { action: 'update', entityType: 'carpentry_expense' };
  if (normalized.includes('/carpentry/expense/delete')) return { action: 'delete', entityType: 'carpentry_expense' };
  if (normalized.includes('/sync')) return { action: 'sync', entityType: 'sync' };

  return {
    action: verb === 'DELETE' ? 'delete' : verb === 'PUT' ? 'update' : 'create',
    entityType: normalized.split('/').filter(Boolean).slice(-1)[0] || 'api',
  };
}

function inferEntityId(payload: AuditPayload): string | null {
  const body = (payload.body as Record<string, unknown> | undefined) ?? {};
  const params = (payload.routeParams as Record<string, unknown> | undefined) ?? {};

  const candidates = [
    body.id,
    body.row_number,
    body.rowNumber,
    body.supplier_name,
    body.name,
    body.rentee_name,
    body.username,
    params.id,
    params.row_number,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    return String(candidate);
  }

  return null;
}

export function recordAuditEvent(payload: AuditPayload): void {
  const { action, entityType } = inferAction(payload.path, payload.method);
  const entityId = inferEntityId(payload);
  const details = {
    method: payload.method,
    path: payload.path,
    statusCode: payload.statusCode,
    params: sanitize(payload.routeParams),
    query: sanitize(payload.query),
    body: sanitize(payload.body),
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (
      user_id, username, action, entity_type, entity_id, details, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    payload.userId ?? null,
    payload.username ?? null,
    action,
    entityType,
    entityId,
    JSON.stringify(details),
    payload.ipAddress ?? null,
    payload.userAgent ?? null,
  );
}
