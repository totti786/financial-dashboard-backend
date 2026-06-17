// ============================================================================
// Auth Integration Tests — login, logout, session, register, init, permissions
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../services/password.service.js', async () => {
  const crypto = await import('node:crypto');
  return {
    verifyPassword: (password: string, hash: string) => {
      const parts = hash.replace('scrypt:', '').split('$');
      const [nStr, rStr, pStr] = parts[0].split(':');
      const salt = Buffer.from(parts[1], 'hex');
      const expectedHash = Buffer.from(parts[2], 'hex');
      const derived = crypto.scryptSync(password, salt, 64, { N: Number(nStr), r: Number(rStr), p: Number(pStr) });
      return derived.length === expectedHash.length && crypto.timingSafeEqual(derived, expectedHash);
    },
    hashPassword: (password: string) => {
      const salt = crypto.randomBytes(16);
      const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
      return `scrypt:16384:8:1$${salt.toString('hex')}$${derived.toString('hex')}`;
    },
  };
});

import { createTestApp } from './create-app.js';
import { initUser, registerUser, login, setupTestApp } from './helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/auth/init — first-user setup', () => {
  it('rejects init when users already exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/init',
      payload: { username: 'another', password: 'secret123' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('rejects init with missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/init',
      payload: { username: 'test' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('username', 'admin');
    expect(body.user).toHaveProperty('permission', 'edit');
    // Verify cookies are set
    expect(res.cookies.length).toBeGreaterThan(0);
    const tokenCookie = res.cookies.find((c: { name: string }) => c.name === 'token');
    expect(tokenCookie).toBeDefined();
  });

  it('rejects invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('rejects non-existent username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'anything' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('supports remember_me for longer session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123', remember_me: true },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears auth cookies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });
});

describe('GET /api/auth/session', () => {
  it('returns authenticated=true for valid token', async () => {
    const session = await setupTestApp(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      cookies: { token: session.token },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.authenticated).toBe(true);
    expect(body.user).toHaveProperty('username', 'admin');
    expect(body.user).toHaveProperty('permission', 'edit');
  });

  it('returns authenticated=false without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.authenticated).toBe(false);
  });

  it('returns authenticated=false for invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      cookies: { token: 'invalid-token-here' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.authenticated).toBe(false);
  });
});

describe('POST /api/auth/register', () => {
  it('registers a new view user when authenticated', async () => {
    const session = await setupTestApp(app);
    const result = await registerUser(app, 'newuser', 'pass123', 'view', session.token);
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.permission).toBe('view');
    expect(body.user_id).toBeGreaterThan(0);
  });

  it('registers a new edit user', async () => {
    const session = await setupTestApp(app);
    const result = await registerUser(app, 'editor', 'pass123', 'edit', session.token);
    expect(result.statusCode).toBe(200);
    const body = result.body as Record<string, unknown>;
    expect(body.permission).toBe('edit');
  });

  it('rejects registration without auth when users exist', async () => {
    const result = await registerUser(app, 'unauth', 'pass123', 'view');
    expect(result.statusCode).toBe(401);
  });

  it('rejects duplicate username', async () => {
    const session = await setupTestApp(app);
    const result = await registerUser(app, 'admin', 'pass123', 'view', session.token);
    expect(result.statusCode).toBe(400);
    const body = result.body as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('rejects invalid permission value', async () => {
    const session = await setupTestApp(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bogus', password: 'pass123', permission: 'superadmin' },
      cookies: { token: session.token },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing fields', async () => {
    const session = await setupTestApp(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'partial' },
      cookies: { token: session.token },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Health endpoint', () => {
  it('GET /api/health returns healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.status).toBe('healthy');
    expect(body.database).toBe('connected');
    expect(body).toHaveProperty('timestamp');
  });
});
