// ============================================================================
// Shared Test Helpers
// ============================================================================

import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { expect } from 'vitest';
import { randomBytes, scryptSync } from 'node:crypto';

export interface AuthSession {
  token: string;
  userId: number;
  username: string;
  permission: string;
}

/**
 * Init the first admin user (via POST /api/auth/init).
 */
export async function initUser(
  app: FastifyInstance,
  username = 'admin',
  password = 'admin123',
): Promise<{ success: boolean }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/init',
    payload: { username, password },
  });
  return res.json();
}

/**
 * Register a new user (requires auth header for non-first users).
 */
export async function registerUser(
  app: FastifyInstance,
  username: string,
  password: string,
  permission = 'view',
  token?: string,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password, permission },
    cookies: token ? { token } : undefined,
  });
  return { statusCode: res.statusCode, body: res.json() as Record<string, unknown> };
}

/**
 * Login and extract the auth session (token cookie + user info).
 */
export async function login(
  app: FastifyInstance,
  username = 'admin',
  password = 'admin123',
): Promise<AuthSession> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });

  expect(res.statusCode).toBe(200);

  const body = res.json() as Record<string, unknown>;
  expect(body.success).toBe(true);

  // Extract token from Set-Cookie header
  const setCookie = res.cookies;
  const tokenCookie = setCookie?.find((c: { name: string }) => c.name === 'token');
  expect(tokenCookie).toBeDefined();
  const token = tokenCookie!.value;

  const user = body.user as Record<string, unknown>;

  return {
    token,
    userId: user.id as number,
    username: user.username as string,
    permission: user.permission as string,
  };
}

/**
 * Create an authenticated test setup: login as pre-created admin user.
 */
export async function setupTestApp(app: FastifyInstance): Promise<AuthSession> {
  return login(app);
}

/**
 * Insert a user directly into the DB with a compatible hash (N=16384).
 * The admin user is pre-created by createTestApp. Use this to create
 * additional test users without going through the register endpoint.
 */
export function insertTestUser(
  app: FastifyInstance,
  username: string,
  password: string,
  permission = 'view',
): { userId: number } {
  const db = (app as unknown as Record<string, unknown>).db as Database.Database;
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const hash = `scrypt:16384:8:1$${salt.toString('hex')}$${derived.toString('hex')}`;
  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, permission, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .run(username, hash, permission);
  return { userId: Number(result.lastInsertRowid) };
}
