// ============================================================================
// Debts Integration Tests — CRUD lifecycle + pay (clamp to 0, new_amount)
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from './create-app.js';
import { setupTestApp } from './helpers.js';
import type { FastifyInstance } from 'fastify';
import type { AuthSession } from './helpers.js';

let app: FastifyInstance;
let admin: AuthSession;

beforeAll(async () => {
  app = await createTestApp();
  admin = await setupTestApp(app);
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/debts', () => {
  it('returns empty debts initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debts',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('debts');
    expect(Array.isArray(body.debts)).toBe(true);
    expect((body.debts as unknown[]).length).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/debts' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Debt CRUD lifecycle', () => {
  let rowNumber: number;

  it('creates a debt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/add',
      payload: { amount: 10000, description: 'Test debt', date: '2026-06-01' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('row_number');
    expect(typeof body.row_number).toBe('number');
    rowNumber = body.row_number as number;
  });

  it('reads the created debt', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debts',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const debts = body.debts as Array<Record<string, unknown>>;
    const found = debts.find((d) => d.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(10000);
    expect(found!.original_amount).toBe(10000);
    expect(typeof found!.amount).toBe('number');
  });

  it('updates the debt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/update',
      payload: { row_number: rowNumber, amount: 8000, description: 'Updated debt', date: '2026-06-15' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('reads the updated debt', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debts',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const debts = body.debts as Array<Record<string, unknown>>;
    const found = debts.find((d) => d.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(8000);
  });

  it('deletes the debt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/delete',
      payload: { row_number: rowNumber },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('confirms deletion', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/debts',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const debts = body.debts as Array<Record<string, unknown>>;
    const found = debts.find((d) => d.row_number === rowNumber);
    expect(found).toBeUndefined();
  });
});

describe('Debt pay — modifyDebtAmount', () => {
  let rowNumber: number;

  it('creates a debt for pay testing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/add',
      payload: { amount: 5000, description: 'Pay test debt', date: '2026-07-01' },
      cookies: { token: admin.token },
    });
    rowNumber = (res.json() as Record<string, unknown>).row_number as number;
    expect(rowNumber).toBeGreaterThan(0);
  });

  it('pays part of the debt (reduces amount)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/pay',
      payload: { row_number: rowNumber, payment_amount: -2000 },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('new_amount');
    expect((body.new_amount as number)).toBe(3000); // 5000 - 2000
    expect(typeof body.new_amount).toBe('number');
  });

  it('pays remaining amount (clamps to 0)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/pay',
      payload: { row_number: rowNumber, payment_amount: -5000 },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.new_amount).toBe(0); // clamped, can't go below 0
  });

  it('adds amount back to debt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/pay',
      payload: { row_number: rowNumber, payment_amount: 2000 },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.new_amount).toBe(2000);
  });

  it('can pay by description/date/original_amount instead of row_number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/pay',
      payload: {
        description: 'Pay test debt',
        date: '2026-07-01',
        original_amount: 5000,
        payment_amount: -1000,
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.new_amount).toBe(1000); // 2000 - 1000
  });
});

describe('Debt validation', () => {
  it('rejects debt with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/add',
      payload: { amount: 100 },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects pay without payment_amount', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/pay',
      payload: {},
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects delete with insufficient criteria', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/debts/delete',
      payload: {},
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
  });
});
