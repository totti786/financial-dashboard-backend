// ============================================================================
// Transactions Integration Tests — CRUD lifecycle for income & expense
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

describe('GET /api/transactions', () => {
  it('returns empty arrays initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('income');
    expect(body).toHaveProperty('expenses');
    expect(body).toHaveProperty('debts');
    expect(Array.isArray(body.income)).toBe(true);
    expect(Array.isArray(body.expenses)).toBe(true);
    expect(Array.isArray(body.debts)).toBe(true);
    expect((body.income as unknown[]).length).toBe(0);
    expect((body.expenses as unknown[]).length).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/transactions' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Income CRUD lifecycle', () => {
  let rowNumber: number;

  it('creates an income transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'income', amount: 1500, description: 'Test income', date: '2026-06-01' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('row_number');
    expect(typeof body.row_number).toBe('number');
    rowNumber = body.row_number as number;
  });

  it('reads the created income transaction', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    const incomes = body.income as Array<Record<string, unknown>>;
    const found = incomes.find((tx) => tx.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(1500);
    expect(typeof found!.amount).toBe('number');
    expect(found!.description).toBe('Test income');
  });

  it('updates the income transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/update',
      payload: { type: 'income', row_number: rowNumber, amount: 2000, description: 'Updated income', date: '2026-06-15' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('reads the updated income transaction', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const incomes = body.income as Array<Record<string, unknown>>;
    const found = incomes.find((tx) => tx.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(2000);
  });

  it('deletes the income transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/delete',
      payload: { type: 'income', row_number: rowNumber },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('confirms deletion', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const incomes = body.income as Array<Record<string, unknown>>;
    const found = incomes.find((tx) => tx.row_number === rowNumber);
    expect(found).toBeUndefined();
  });
});

describe('Expense CRUD lifecycle', () => {
  let rowNumber: number;

  it('creates an expense transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'expense', amount: 500, description: 'Test expense', date: '2026-06-10' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('row_number');
    rowNumber = body.row_number as number;
  });

  it('reads the created expense', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const expenses = body.expenses as Array<Record<string, unknown>>;
    const found = expenses.find((tx) => tx.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(500);
    expect(typeof found!.amount).toBe('number');
  });

  it('updates the expense', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/update',
      payload: { type: 'expense', row_number: rowNumber, amount: 750, description: 'Updated expense', date: '2026-06-20' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });

  it('deletes the expense', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/delete',
      payload: { type: 'expense', row_number: rowNumber },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Transaction validation', () => {
  it('rejects transaction with invalid type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'invalid', amount: 100, description: 'Bad', date: '2026-01-01' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects transaction with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'income', amount: 100 },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Amount types are numbers', () => {
  it('verifies amount fields are numbers not strings', async () => {
    // Create a transaction
    await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'income', amount: 999.99, description: 'Type check', date: '2026-06-01' },
      cookies: { token: admin.token },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const incomes = body.income as Array<Record<string, unknown>>;
    const found = incomes.find((tx) => tx.description === 'Type check');
    expect(found).toBeDefined();
    expect(typeof found!.amount).toBe('number');
    expect(typeof found!.row_number).toBe('number');
    expect(typeof found!.id).toBe('number');
  });
});
