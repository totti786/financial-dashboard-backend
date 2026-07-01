// ============================================================================
// Rent Integration Tests — CRUD lifecycle + month toggle + cascade delete
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

describe('GET /api/rent', () => {
  it('returns empty rent data initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rent',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.rent_data)).toBe(true);
    expect((body.rent_data as unknown[]).length).toBe(0);
  });
});

describe('Rent CRUD lifecycle', () => {
  let rowNumber: number;
  let renteeId: number;

  it('creates a rentee', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rent/add',
      payload: { rentee_name: 'Test Rentee', rent_amount: 500 },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.result).toHaveProperty('row_number');
    expect(body.result).toHaveProperty('id');
    rowNumber = (body.result as Record<string, unknown>).row_number as number;
    renteeId = (body.result as Record<string, unknown>).id as number;
  });

  it('reads the created rentee with 12 monthly payments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rent',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    const rentData = body.rent_data as Array<Record<string, unknown>>;
    const found = rentData.find((r) => r.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.rentee_name).toBe('Test Rentee');
    expect(found!.rent_amount).toBe(500);
    expect(found!.monthly_payments).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(found!.monthly_details).toHaveLength(12);
    expect(found!.sham_cash_payments).toHaveLength(12);
  });

  it('updates the rentee name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rent/update',
      payload: { row_number: rowNumber, rentee_name: 'Updated Rentee' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });

  it('toggles a month as paid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rowNumber, year: new Date().getFullYear(), month: 3, is_paid: true },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('reads updated month payment status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rent',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const rentData = body.rent_data as Array<Record<string, unknown>>;
    const found = rentData.find((r) => r.row_number === rowNumber);
    expect(found).toBeDefined();
    // Month 3 should be paid (index 2)
    const monthlyPays = found!.monthly_payments as number[];
    expect(monthlyPays[2]).toBe(1);
    // Month 12 should still be unpaid
    expect(monthlyPays[11]).toBe(0);
  });

  it('toggles sham_cash on a month', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rowNumber, year: new Date().getFullYear(), month: 3, is_paid: true, is_sham_cash: true },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });

  it('reads sham_cash payment status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rent',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const rentData = body.rent_data as Array<Record<string, unknown>>;
    const found = rentData.find((r) => r.row_number === rowNumber);
    expect(found).toBeDefined();
    const shamCash = found!.sham_cash_payments as number[];
    expect(shamCash[2]).toBe(1);
  });

  it('rejects invalid month number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rowNumber, year: new Date().getFullYear(), month: 13, is_paid: true },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
  });

  it('deletes the rentee (cascade deletes payments)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rent/delete',
      payload: { row_number: rowNumber },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('confirms deletion — rentee is gone', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rent',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const rentData = body.rent_data as Array<Record<string, unknown>>;
    const found = rentData.find((r) => r.row_number === rowNumber);
    expect(found).toBeUndefined();
  });
});

describe('Rent amount types', () => {
  it('rent_amount is a number', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rent',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const rentData = body.rent_data as Array<Record<string, unknown>>;
    for (const r of rentData) {
      expect(typeof r.rent_amount).toBe('number');
    }
  });
});

describe('Rent payment history by year', () => {
  let rowNumber: number;

  it('keeps the same month independent across years', async () => {
    const addResponse = await app.inject({
      method: 'POST',
      url: '/api/rent/add',
      payload: { rentee_name: 'Year-aware renter', rent_amount: 750 },
      cookies: { token: admin.token },
    });
    rowNumber = addResponse.json().result.row_number as number;

    await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rowNumber, year: 2025, month: 3, is_paid: true },
      cookies: { token: admin.token },
    });

    const response2025 = await app.inject({
      method: 'GET',
      url: '/api/rent?year=2025',
      cookies: { token: admin.token },
    });
    const response2026 = await app.inject({
      method: 'GET',
      url: '/api/rent?year=2026',
      cookies: { token: admin.token },
    });

    const renter2025 = response2025.json().rent_data.find(
      (renter: { row_number: number }) => renter.row_number === rowNumber,
    );
    const renter2026 = response2026.json().rent_data.find(
      (renter: { row_number: number }) => renter.row_number === rowNumber,
    );

    expect(renter2025.monthly_payments[2]).toBe(1);
    expect(renter2026.monthly_payments[2]).toBe(0);

    await app.inject({
      method: 'POST',
      url: '/api/rent/month',
      payload: { row_number: rowNumber, year: 2026, month: 3, is_paid: true },
      cookies: { token: admin.token },
    });

    const stillPaid2025 = await app.inject({
      method: 'GET',
      url: '/api/rent?year=2025',
      cookies: { token: admin.token },
    });
    const historicalRenter = stillPaid2025.json().rent_data.find(
      (renter: { row_number: number }) => renter.row_number === rowNumber,
    );
    expect(historicalRenter.monthly_payments[2]).toBe(1);
  });
});
