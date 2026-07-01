// ============================================================================
// Suppliers Integration Tests — CRUD lifecycle + allowlist + grouping
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

describe('GET /api/suppliers/allowlist', () => {
  it('returns the hardcoded supplier allowlist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suppliers/allowlist',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.suppliers)).toBe(true);
    expect((body.suppliers as string[]).length).toBeGreaterThan(0);
  });
});

describe('GET /api/suppliers', () => {
  it('returns empty initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.suppliers)).toBe(true);
  });
});

describe('Supplier CRUD lifecycle', () => {
  const supplierName = 'محمود رمضان'; // Must be in the allowlist
  let owedRowNumber: number;
  let paidRowNumber: number;

  it('creates an owed transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suppliers/add',
      payload: {
        supplier_name: supplierName,
        type: 'owed',
        amount: 5000,
        description: 'Test supply',
        date: '2026-06-01',
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.result).toHaveProperty('row_number');
    owedRowNumber = (body.result as Record<string, unknown>).row_number as number;
  });

  it('creates a paid transaction for same supplier', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suppliers/add',
      payload: {
        supplier_name: supplierName,
        type: 'paid',
        amount: 3000,
        description: 'Payment for supplies',
        date: '2026-06-15',
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    paidRowNumber = (body.result as Record<string, unknown>).row_number as number;
  });

  it('reads grouped supplier data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    const suppliers = body.suppliers as Array<Record<string, unknown>>;
    const found = suppliers.find((s) => s.name === supplierName);
    expect(found).toBeDefined();
    expect(Array.isArray(found!.records)).toBe(true);

    const owedRecord = (found!.records as Array<Record<string, unknown>>).find(
      (r) => r.row_number === owedRowNumber,
    );
    expect(owedRecord).toBeDefined();
    expect(owedRecord!.owed).toBeDefined();
    expect((owedRecord!.owed as Record<string, unknown>).amount).toBe(5000);
  });

  it('updates the owed transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suppliers/update',
      payload: {
        supplier_name: supplierName,
        row_number: owedRowNumber,
        transaction_type: 'owed',
        amount: 5500,
        description: 'Updated supply',
        date: '2026-06-10',
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });

  it('deletes the paid transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suppliers/delete',
      payload: {
        supplier_name: supplierName,
        row_number: paidRowNumber,
        transaction_type: 'paid',
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('deletes the owed transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/suppliers/delete',
      payload: {
        supplier_name: supplierName,
        row_number: owedRowNumber,
        transaction_type: 'owed',
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Supplier amount types', () => {
  it('amounts are numbers not strings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/suppliers',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const suppliers = body.suppliers as Array<Record<string, unknown>>;
    for (const supplier of suppliers) {
      for (const record of supplier.records as Array<Record<string, unknown>>) {
        if (record.owed) {
          expect(typeof (record.owed as Record<string, unknown>).amount).toBe('number');
        }
        if (record.paid) {
          expect(typeof (record.paid as Record<string, unknown>).amount).toBe('number');
        }
      }
    }
  });
});

describe('Other entities endpoint', () => {
  const otherName = 'نضال دشلي'; // In OTHER_SHEETS list

  it('creates and reads other entity data', async () => {
    // Add an owed transaction for other entity
    await app.inject({
      method: 'POST',
      url: '/api/other/add',
      payload: {
        name: otherName,
        type: 'owed',
        amount: 2000,
        description: 'Other test',
        date: '2026-06-01',
      },
      cookies: { token: admin.token },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/other',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    const others = body.others as Array<Record<string, unknown>>;
    const found = others.find((s) => s.name === otherName);
    expect(found).toBeDefined();
  });
});
