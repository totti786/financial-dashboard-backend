// ============================================================================
// Admin Integration Tests — users CRUD, audit log, config
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from './create-app.js';
import { setupTestApp, insertTestUser } from './helpers.js';
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

describe('GET /api/users', () => {
  it('returns the users list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.users)).toBe(true);
    expect((body.users as unknown[]).length).toBeGreaterThanOrEqual(1);

    const users = body.users as Array<Record<string, unknown>>;
    const foundAdmin = users.find((u) => u.username === 'admin');
    expect(foundAdmin).toBeDefined();
    expect(foundAdmin!.permission).toBe('edit');
  });
});

describe('PUT /api/users/:id', () => {
  it('updates a user permission', async () => {
    const { userId } = insertTestUser(app, 'updatable', 'pass123', 'view');

    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${userId}`,
      payload: { permission: 'edit' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('updates a username', async () => {
    const { userId } = insertTestUser(app, 'rename', 'pass123', 'view');

    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${userId}`,
      payload: { username: 'renamed' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/99999',
      payload: { permission: 'edit' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes a user', async () => {
    const { userId } = insertTestUser(app, 'deleteme', 'pass123', 'view');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${userId}`,
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('cannot delete self', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${admin.userId}`,
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });
});

describe('GET /api/audit', () => {
  it('returns audit log entries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('supports query filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit?action=add&entity_type=carpentry_income&limit=5',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });
});

describe('GET /api/admin/config', () => {
  it('returns the app config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/config',
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.config).toHaveProperty('apps_script_api_url');
    expect(body.config).toHaveProperty('spreadsheet_id');
    expect(body.config).toHaveProperty('tracked_cells');
  });
});

describe('POST /api/admin/config', () => {
  it('updates the config', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/config',
      payload: { apps_script_api_url: 'https://example.com/api' },
      cookies: { token: admin.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.config).toHaveProperty('apps_script_api_url', 'https://example.com/api');
  });
});
