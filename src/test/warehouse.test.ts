// ============================================================================
// Warehouse Integration Tests — CRUD lifecycle + volume calculation
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

describe('GET /api/warehouse', () => {
  it('returns empty inventory initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/warehouse',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.inventory)).toBe(true);
    expect((body.inventory as unknown[]).length).toBe(0);
  });
});

describe('Warehouse CRUD lifecycle with volume calculation', () => {
  let rowNumber: number;

  it('creates a warehouse item (volume auto-calculated)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/warehouse/add',
      payload: {
        timber_type: 'Oak',
        length: 200,   // cm
        width: 10,     // cm
        thickness: 5,  // cm
        number_of_blanks: 1,
        value_per_cubic_meter: 2000,
        grade: 'A',
        location: 'Shelf 1',
        notes: 'Premium oak',
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.result).toHaveProperty('row_number');
    rowNumber = (body.result as Record<string, unknown>).row_number as number;
    expect(rowNumber).toBeGreaterThan(0);
  });

  it('reads the created item with correct volume', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/warehouse',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const inventory = body.inventory as Array<Record<string, unknown>>;
    const found = inventory.find((item) => item.row_number === rowNumber);
    expect(found).toBeDefined();
    expect(found!.timber_type).toBe('Oak');

    // Volume: (200 * 10 * 5 * 1) / 1,000,000 = 0.01 m³
    expect(found!.volume).toBeCloseTo(0.01, 5);
    // Total value: 0.01 * 2000 = 20
    expect(found!.total_value).toBeCloseTo(20, 2);
    expect(typeof found!.volume).toBe('number');
    expect(typeof found!.total_value).toBe('number');
  });

  it('updates the item dimensions (recalculates volume)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/warehouse/update',
      payload: {
        row_number: rowNumber,
        timber_type: 'Oak',
        length: 250,   // changed
        width: 10,
        thickness: 5,
        number_of_blanks: 2,  // changed
        value_per_cubic_meter: 2000,
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('reads updated volume', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/warehouse',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const inventory = body.inventory as Array<Record<string, unknown>>;
    const found = inventory.find((item) => item.row_number === rowNumber);
    expect(found).toBeDefined();
    // Volume: (250 * 10 * 5 * 2) / 1,000,000 = 0.025 m³
    expect(found!.volume).toBeCloseTo(0.025, 5);
    // Total value: 0.025 * 2000 = 50
    expect(found!.total_value).toBeCloseTo(50, 2);
  });

  it('deletes the item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/warehouse/delete',
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
      url: '/api/warehouse',
      cookies: { token: admin.token },
    });
    const body = res.json() as Record<string, unknown>;
    const inventory = body.inventory as Array<Record<string, unknown>>;
    const found = inventory.find((item) => item.row_number === rowNumber);
    expect(found).toBeUndefined();
  });
});

describe('Warehouse with null value_per_cubic_meter', () => {
  it('creates item without value_per_cubic_meter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/warehouse/add',
      payload: {
        timber_type: 'Pine',
        length: 100,
        width: 10,
        thickness: 2,
      },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.result).toHaveProperty('row_number');
    const rowNum = (body.result as Record<string, unknown>).row_number as number;

    // Verify in GET
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/warehouse',
      cookies: { token: admin.token },
    });
    const getBody = getRes.json() as Record<string, unknown>;
    const inventory = getBody.inventory as Array<Record<string, unknown>>;
    const found = inventory.find((item) => item.row_number === rowNum);
    expect(found).toBeDefined();
    expect(found!.value_per_cubic_meter).toBeNull();
    expect(found!.total_value).toBeNull();
    // Volume still calculated: (100 * 10 * 2 * 1) / 1,000,000 = 0.002
    expect(found!.volume).toBeCloseTo(0.002, 5);
  });
});
