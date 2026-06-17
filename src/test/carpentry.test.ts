// ============================================================================
// Carpentry Integration Tests — CRUD lifecycle + firas_share calculation
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

describe('GET /api/carpentry', () => {
  it('returns empty carpentry data initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/carpentry',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('income');
    expect(body).toHaveProperty('expenses');
    expect(body).toHaveProperty('monthly_summaries');
    expect(body).toHaveProperty('overall_totals');
  });
});

describe('Carpentry income CRUD', () => {
  let rowNumber: number;

  it('creates carpentry income', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/carpentry/income/add',
      payload: { amount: 10000, description: 'Custom furniture', date: '2026-06-15' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.record).toHaveProperty('row_number');
    rowNumber = (body.record as Record<string, unknown>).row_number as number;
    expect(body.record).toHaveProperty('month');
    expect(body.record).toHaveProperty('year');
  });

  it('reads the created income', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/carpentry',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const incomes = body.income as Array<Record<string, unknown>>;
    const found = incomes.find((inc) => inc.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.amount).toBe(10000);
    expect(typeof found!.amount).toBe('number');
  });

  it('updates carpentry income', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/carpentry/income/update',
      payload: { row_number: rowNumber, amount: 12000, description: 'Premium furniture', date: '2026-06-20' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('deletes carpentry income', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/carpentry/income/delete',
      payload: { row_number: rowNumber },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });
});

describe('Carpentry expense CRUD', () => {
  let rowNumber: number;

  it('creates a normal carpentry expense', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/carpentry/expense/add',
      payload: { amount: 2000, description: 'Wood materials', date: '2026-06-10' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    rowNumber = (body.record as Record<string, unknown>).row_number as number;
    expect((body.record as Record<string, unknown>).is_internal).toBe(false);
    expect((body.record as Record<string, unknown>).is_firas).toBe(false);
  });

  it('creates an internal+firas expense', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/carpentry/expense/add',
      payload: {
        amount: 500,
        description: 'Internal tool',
        date: '2026-06-12',
        is_internal: true,
        is_firas: true,
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.record).toHaveProperty('row_number');
    expect((body.record as Record<string, unknown>).is_internal).toBe(true);
    expect((body.record as Record<string, unknown>).is_firas).toBe(true);
  });
});

describe('Carpentry firas_share calculation', () => {
  it('calculates overall totals correctly', async () => {
    // Add income: 10000
    await app.inject({
      method: 'POST',
      url: '/api/carpentry/income/add',
      payload: { amount: 8000, description: 'Another job', date: '2026-06-25' },
      cookies: { token: admin.token },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/carpentry',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const totals = body.overall_totals as Record<string, unknown>;

    // total_income = 8000 (second income, first was deleted)
    expect(totals.total_income).toBe(8000);
    // total_expenses = 2000 + 500 = 2500
    expect(totals.total_expenses).toBe(2500);
    // net_income = 8000 - (2500 - 500) = 8000 - 2000 = 6000
    expect(totals.net_income).toBe(6000);
    // firas_share = 6000 * 0.8 = 4800
    expect(totals.firas_share).toBe(4800);

    expect(typeof totals.total_income).toBe('number');
    expect(typeof totals.firas_share).toBe('number');
  });
});

describe('Carpentry amount types', () => {
  it('all amount fields are numbers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/carpentry',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;

    for (const inc of body.income as Array<Record<string, unknown>>) {
      expect(typeof inc.amount).toBe('number');
      expect(typeof inc.row_number).toBe('number');
    }
    for (const exp of body.expenses as Array<Record<string, unknown>>) {
      expect(typeof exp.amount).toBe('number');
      expect(typeof exp.row_number).toBe('number');
    }

    const totals = body.overall_totals as Record<string, unknown>;
    for (const value of Object.values(totals)) {
      expect(typeof value).toBe('number');
    }
  });
});
