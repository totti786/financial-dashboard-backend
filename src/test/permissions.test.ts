// ============================================================================
// Permissions Integration Tests — 401 for unauth, 403 for view-only
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from './create-app.js';
import { setupTestApp, insertTestUser } from './helpers.js';
import type { FastifyInstance } from 'fastify';
import type { AuthSession } from './helpers.js';

let app: FastifyInstance;
let admin: AuthSession;
let viewUserToken: string;

beforeAll(async () => {
  app = await createTestApp();
  admin = await setupTestApp(app);

  insertTestUser(app, 'viewer', 'pass123', 'view');

  // Login as view user
  const viewLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'viewer', password: 'pass123' },
  });
  const viewLoginBody = viewLogin.json() as Record<string, unknown>;
  expect(viewLoginBody.success).toBe(true);
  const setCookie = viewLogin.cookies;
  const tokenCookie = setCookie?.find((c: { name: string }) => c.name === 'token');
  viewUserToken = tokenCookie!.value;
});

afterAll(async () => {
  await app.close();
});

// ── 401: Unauthenticated (no token) ─────────────────────────────────────────

describe('401 — no auth token', () => {
  const protectedRoutes: Array<{ method: string; url: string; payload?: Record<string, unknown> }> = [
    { method: 'GET', url: '/api/transactions' },
    { method: 'POST', url: '/api/transactions/add', payload: { type: 'income', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/transactions/update', payload: { type: 'income', row_number: 1, amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/transactions/delete', payload: { type: 'income', row_number: 1 } },
    { method: 'GET', url: '/api/debts' },
    { method: 'POST', url: '/api/debts/add', payload: { amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'GET', url: '/api/suppliers' },
    { method: 'POST', url: '/api/suppliers/add', payload: { supplier_name: 'محمود رمضان', type: 'owed', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'GET', url: '/api/rent' },
    { method: 'POST', url: '/api/rent/add', payload: { rentee_name: 'x', rent_amount: 100 } },
    { method: 'GET', url: '/api/warehouse' },
    { method: 'POST', url: '/api/warehouse/add', payload: { timber_type: 'Oak', length: 100, width: 10, thickness: 2 } },
    { method: 'GET', url: '/api/data' },
    { method: 'GET', url: '/api/users' },
    { method: 'GET', url: '/api/audit' },
  ];

  for (const route of protectedRoutes) {
    it(`${route.method} ${route.url} returns 401`, async () => {
      const res = await app.inject({
        method: route.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: route.url,
        payload: route.payload,
      });
      expect(res.statusCode).toBe(401);
    });
  }
});

// ── 403: View-only user cannot mutate ───────────────────────────────────────

describe('403 — view-only user', () => {
  const mutatingRoutes: Array<{ method: string; url: string; payload?: Record<string, unknown> }> = [
    { method: 'POST', url: '/api/transactions/add', payload: { type: 'income', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/transactions/update', payload: { type: 'income', row_number: 1, amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/transactions/delete', payload: { type: 'income', row_number: 1 } },
    { method: 'POST', url: '/api/debts/add', payload: { amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/debts/pay', payload: { row_number: 1, payment_amount: -50 } },
    { method: 'POST', url: '/api/debts/delete', payload: { row_number: 1 } },
    { method: 'POST', url: '/api/suppliers/add', payload: { supplier_name: 'محمود رمضان', type: 'owed', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/suppliers/update', payload: { supplier_name: 'محمود رمضان', row_number: 1, transaction_type: 'owed', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/suppliers/delete', payload: { supplier_name: 'محمود رمضان', row_number: 1, transaction_type: 'owed' } },
    { method: 'POST', url: '/api/rent/add', payload: { rentee_name: 'x', rent_amount: 100 } },
    { method: 'POST', url: '/api/rent/update', payload: { row_number: 1, rentee_name: 'x' } },
    { method: 'POST', url: '/api/rent/month', payload: { row_number: 1, month: 1, is_paid: true } },
    { method: 'POST', url: '/api/rent/delete', payload: { row_number: 1 } },
    { method: 'POST', url: '/api/warehouse/add', payload: { timber_type: 'Oak', length: 100, width: 10, thickness: 2 } },
    { method: 'POST', url: '/api/warehouse/update', payload: { row_number: 1, timber_type: 'Oak' } },
    { method: 'POST', url: '/api/warehouse/delete', payload: { row_number: 1 } },
    { method: 'POST', url: '/api/carpentry/income/add', payload: { amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/carpentry/income/update', payload: { row_number: 1, amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/carpentry/income/delete', payload: { row_number: 1 } },
    { method: 'POST', url: '/api/carpentry/expense/add', payload: { amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/carpentry/expense/update', payload: { row_number: 1, amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/carpentry/expense/delete', payload: { row_number: 1 } },
    { method: 'POST', url: '/api/other/add', payload: { name: 'نضال دشلي', type: 'owed', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/other/update', payload: { name: 'نضال دشلي', row_number: 1, transaction_type: 'owed', amount: 100, description: 'x', date: '2026-01-01' } },
    { method: 'POST', url: '/api/other/delete', payload: { name: 'نضال دشلي', row_number: 1, transaction_type: 'owed' } },
    { method: 'GET', url: '/api/admin/config' },
    { method: 'POST', url: '/api/admin/config', payload: { apps_script_api_url: 'x' } },
    { method: 'GET', url: '/api/users' },
    { method: 'PUT', url: '/api/users/1', payload: { permission: 'edit' } },
    { method: 'DELETE', url: '/api/users/1' },
    { method: 'GET', url: '/api/audit' },
  ];

  for (const route of mutatingRoutes) {
    it(`${route.method} ${route.url} returns 403 for view-only user`, async () => {
      const res = await app.inject({
        method: route.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: route.url,
        payload: route.payload,
        cookies: { token: viewUserToken },
      });
      expect(res.statusCode).toBe(403);
    });
  }
});

// ── View-only user can read ────────────────────────────────────────────────

describe('200 — view-only user can read', () => {
  const readRoutes = [
    { method: 'GET', url: '/api/transactions' },
    { method: 'GET', url: '/api/debts' },
    { method: 'GET', url: '/api/suppliers' },
    { method: 'GET', url: '/api/rent' },
    { method: 'GET', url: '/api/warehouse' },
    { method: 'GET', url: '/api/data' },
  ];

  for (const route of readRoutes) {
    it(`${route.method} ${route.url} returns 200 for view-only user`, async () => {
      const res = await app.inject({
        method: route.method as 'GET',
        url: route.url,
        cookies: { token: viewUserToken },
      });
      expect(res.statusCode).toBe(200);
    });
  }
});
