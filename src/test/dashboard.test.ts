// ============================================================================
// Dashboard Integration Tests — /api/data returns all fields
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

describe('GET /api/data', () => {
  it('returns dashboard data with all expected fields', async () => {
    // Seed some data so the dashboard has values
    // Add income
    await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'income', amount: 50000, description: 'مبيعات يونيو', date: '2026-06-01' },
      cookies: { token: admin.token },
    });
    // Add expense
    await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'expense', amount: 15000, description: 'مصاريف', date: '2026-06-05' },
      cookies: { token: admin.token },
    });
    // Add debt
    await app.inject({
      method: 'POST',
      url: '/api/debts/add',
      payload: { amount: 20000, description: 'دين', date: '2026-06-01' },
      cookies: { token: admin.token },
    });
    // Add rentee + mark month as paid
    const rentRes = await app.inject({
      method: 'POST',
      url: '/api/rent/add',
      payload: { rentee_name: 'مستأجر', rent_amount: 1000 },
      cookies: { token: admin.token },
    });
    const rentRowNumber = (rentRes.json() as Record<string, unknown>).result as Record<string, unknown>;
    await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rentRowNumber.row_number, month: new Date().getMonth() + 1, is_paid: true },
      cookies: { token: admin.token },
    });
    // Add carpentry income
    await app.inject({
      method: 'POST',
      url: '/api/carpentry/income/add',
      payload: { amount: 3000, description: 'Carpentry work', date: '2026-06-15' },
      cookies: { token: admin.token },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/data',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);

    const dashboard = res.json() as Record<string, unknown>;

    // All required fields
    const requiredFields = [
      'total_income',
      'total_sales',
      'other_business_income',
      'carpentry_business_expenses',
      'house_fund',
      'rentals',
      'sham_cash_income',
      'sham_cash_expenses',
      'net_sham_cash_income',
      'total_payments',
      'personal_expenses',
      'net_income',
      'total_debts',
      'daily_sales',
      'total_to_date',
      'avg_daily',
      'remaining_days',
      'projected_total_income',
    ];

    for (const field of requiredFields) {
      expect(dashboard).toHaveProperty(field);
    }

    // Numeric fields are numbers
    const numericFields = [
      'total_income', 'total_sales', 'other_business_income',
      'carpentry_business_expenses', 'house_fund', 'rentals',
      'sham_cash_income', 'sham_cash_expenses', 'net_sham_cash_income',
      'total_payments', 'personal_expenses', 'net_income', 'total_debts',
      'total_to_date', 'avg_daily', 'remaining_days', 'projected_total_income',
    ];
    for (const field of numericFields) {
      expect(typeof dashboard[field]).toBe('number');
    }

    // daily_sales is an array
    expect(Array.isArray(dashboard.daily_sales)).toBe(true);

    // Validate some expected values based on seeded data
    expect(dashboard.total_debts).toBe(20000);
    // total_income should include the income + carpentry income + rent
    expect(dashboard.total_income).toBeGreaterThan(0);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/data' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/monthly-sales', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/monthly-sales' });
    expect(res.statusCode).toBe(401);
  });

  it('returns monthly sales data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/monthly-sales',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    // The route returns a sales array
    expect(body).toHaveProperty('sales');
  });
});
