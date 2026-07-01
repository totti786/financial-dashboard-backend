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
      payload: { row_number: rentRowNumber.row_number, year: new Date().getFullYear(), month: new Date().getMonth() + 1, is_paid: true },
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

  it('filters activity totals by the requested reporting period', async () => {
    const requests = [
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'income', amount: 110, description: 'مبيعات يناير', date: '2025-01-10' },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'expense', amount: 10, description: 'January expense', date: '2025-01-11' },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'income', amount: 220, description: 'مبيعات فبراير', date: '2025-02-10' },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'expense', amount: 20, description: 'February expense', date: '2025-02-11' },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/carpentry/income/add',
        payload: { amount: 30, description: 'January workshop', date: '2025-01-12' },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/carpentry/expense/add',
        payload: { amount: 5, description: 'January workshop expense', date: '2025-01-13' },
        cookies: { token: admin.token },
      }),
    ];
    await Promise.all(requests);

    const rentResponse = await app.inject({
      method: 'POST',
      url: '/api/rent/add',
      payload: { rentee_name: 'Historical renter', rent_amount: 40 },
      cookies: { token: admin.token },
    });
    const rentResult = rentResponse.json().result as { row_number: number };
    await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rentResult.row_number, year: 2025, month: 1, is_paid: true },
      cookies: { token: admin.token },
    });

    const januaryResponse = await app.inject({
      method: 'GET',
      url: '/api/data?year=2025&month=1',
      cookies: { token: admin.token },
    });
    const january = januaryResponse.json() as Record<string, unknown>;

    expect(januaryResponse.statusCode).toBe(200);
    expect(january.total_sales).toBe(110);
    expect(january.total_income).toBe(180);
    expect(january.total_payments).toBe(10);
    expect(january.net_income).toBe(170);
    expect(january.rentals).toBe(40);
    expect(january.other_business_income).toBe(30);
    expect(january.carpentry_business_expenses).toBe(5);
    expect(january.daily_sales).toEqual([
      { day: 'Jan 10', amount: 110, date: '2025-01-10' },
    ]);

    const februaryResponse = await app.inject({
      method: 'GET',
      url: '/api/data?year=2025&month=2',
      cookies: { token: admin.token },
    });
    const february = februaryResponse.json() as Record<string, unknown>;
    expect(february.total_sales).toBe(220);
    expect(february.total_income).toBe(220);
    expect(february.total_payments).toBe(20);
    expect(february.rentals).toBe(0);
    expect(february.other_business_income).toBe(0);
    expect(february.carpentry_business_expenses).toBe(0);
  });

  it('rejects an invalid reporting period', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/data?year=2025&month=13',
      cookies: { token: admin.token },
    });
    expect(response.statusCode).toBe(400);
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
    // Even without data, the response should have the right shape
    expect(body).toHaveProperty('sales_by_year');
    expect(body).toHaveProperty('available_years');
  });

  it('aggregates retained sales transactions into their historical months', async () => {
    await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'income', amount: 125, description: 'مبيعات آذار', date: '2024-03-05', is_sales: true },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'income', amount: 75, description: 'مبيعات آذار', date: '2024-03-20', is_sales: true },
        cookies: { token: admin.token },
      }),
      app.inject({
        method: 'POST',
        url: '/api/transactions/add',
        payload: { type: 'income', amount: 999, description: 'Not a sale', date: '2024-03-21' },
        cookies: { token: admin.token },
      }),
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/monthly-sales',
      cookies: { token: admin.token },
    });
    const body = response.json() as {
      sales_by_year: Record<string, Array<{ month_index: number; amount: number }>>;
      available_years: string[];
    };
    const march = body.sales_by_year['2024']?.find((entry) => entry.month_index === 3);

    expect(response.statusCode).toBe(200);
    expect(march?.amount).toBe(200);
    expect(body.available_years).toContain('2024');
  });

  it('finalizes a monthly sales snapshot and only changes it when re-finalized', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'income', amount: 300, description: 'مبيعات نيسان', date: '2024-04-10', is_sales: true },
      cookies: { token: admin.token },
    });

    const finalizeResponse = await app.inject({
      method: 'POST',
      url: '/api/monthly-sales/finalize',
      payload: { year: 2024, month: 4 },
      cookies: { token: admin.token },
    });
    expect(finalizeResponse.statusCode).toBe(200);
    expect(finalizeResponse.json().result).toMatchObject({
      year: 2024,
      month_index: 4,
      amount: 300,
      finalized_by: admin.username,
    });

    await app.inject({
      method: 'POST',
      url: '/api/transactions/add',
      payload: { type: 'income', amount: 50, description: 'مبيعات تصحيح', date: '2024-04-20', is_sales: true },
      cookies: { token: admin.token },
    });

    const afterCorrection = await app.inject({
      method: 'GET',
      url: '/api/monthly-sales',
      cookies: { token: admin.token },
    });
    const frozenApril = afterCorrection.json().sales_by_year['2024'].find(
      (entry: { month_index: number }) => entry.month_index === 4,
    );
    expect(frozenApril.amount).toBe(300);

    const refinalizeResponse = await app.inject({
      method: 'POST',
      url: '/api/monthly-sales/finalize',
      payload: { year: 2024, month: 4 },
      cookies: { token: admin.token },
    });
    expect(refinalizeResponse.json().result.amount).toBe(350);
  });

  it('does not finalize the current calendar month', async () => {
    const now = new Date();
    const response = await app.inject({
      method: 'POST',
      url: '/api/monthly-sales/finalize',
      payload: { year: now.getFullYear(), month: now.getMonth() + 1 },
      cookies: { token: admin.token },
    });
    expect(response.statusCode).toBe(400);
  });
});
