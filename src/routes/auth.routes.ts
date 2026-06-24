import type { FastifyInstance } from 'fastify';
import {
  getUserByUsername,
  getUserById,
  createUser,
  getAllUsers,
} from '../db/index.js';
import { verifyPassword, hashPassword } from '../services/password.service.js';
import { generateTokens, verifyToken, refreshTokens } from '../services/auth.service.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

// ── Cookie helpers ─────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;
const THIRTY_DAYS = 30 * 24 * 60 * 60;

// ── Routes ─────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // ── POST /api/auth/login ──────────────────────────────────────────────
  app.post('/login', async (request, reply) => {
    try {
      const body = request.body as {
        username?: string;
        password?: string;
        remember_me?: boolean;
      };
      const { username, password } = body;
      const rememberMe = body.remember_me ?? false;

      if (!username || !password) {
        return reply
          .status(400)
          .send({ success: false, error: 'Username and password required' });
      }

      const user = getUserByUsername(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return reply
          .status(401)
          .send({ success: false, error: 'Invalid username or password' });
      }

      const tokens = generateTokens(
        {
          userId: user.id,
          username: user.username,
          permission: user.permission,
        },
        rememberMe,
      );

      const tokenMaxAge = rememberMe ? THIRTY_DAYS : SEVEN_DAYS;

      reply
        .setCookie('token', tokens.accessToken, cookieOptions(tokenMaxAge))
        .setCookie(
          'refresh_token',
          tokens.refreshToken,
          cookieOptions(THIRTY_DAYS),
        );

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          permission: user.permission,
        },
      };
    } catch (error) {
      request.log.error(error, 'Login error');
      return reply
        .status(500)
        .send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────
  app.post('/logout', async (_request, reply) => {
    reply
      .clearCookie('token', { path: '/' })
      .clearCookie('refresh_token', { path: '/' });
    return { success: true, message: 'Logged out' };
  });

  // ── GET /api/auth/session ─────────────────────────────────────────────
  app.get('/session', async (request, reply) => {
    try {
      const token = request.cookies?.token;
      if (!token) {
        return { authenticated: false };
      }

      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        return { authenticated: false };
      }

      // First try lookup by user ID (primary method)
      let user = getUserById(payload.userId);

      // If not found by ID, try by username (handles DB rebuild)
      if (!user) {
        user = getUserByUsername(payload.username);
        if (!user) {
          return { authenticated: false };
        }

        // Update the token payload with new user_id
        const tokens = generateTokens({
          userId: user.id,
          username: user.username,
          permission: user.permission,
        });
        reply.setCookie('token', tokens.accessToken, cookieOptions(SEVEN_DAYS));
      }

      return {
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          permission: user.permission,
        },
      };
    } catch (error) {
      request.log.error(error, 'Session error');
      return { authenticated: false };
    }
  });

  // ── POST /api/auth/refresh ─────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    try {
      const refreshToken = request.cookies?.refresh_token;
      if (!refreshToken) {
        return reply
          .status(401)
          .send({ success: false, error: 'No refresh token' });
      }

      let tokens;
      try {
        tokens = refreshTokens(refreshToken);
      } catch {
        return reply
          .status(401)
          .send({ success: false, error: 'Invalid or expired refresh token' });
      }

      // Set new access token cookie (7 days — refresh tokens max out at 7d anyway)
      reply.setCookie('token', tokens.accessToken, cookieOptions(SEVEN_DAYS));

      return { success: true };
    } catch (error) {
      request.log.error(error, 'Token refresh error');
      return reply
        .status(500)
        .send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/auth/register ───────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    try {
      const body = request.body as {
        username?: string;
        password?: string;
        permission?: string;
      };
      const { username, password } = body;
      const requestedPermission = body.permission ?? 'view';

      if (!username || !password) {
        return reply
          .status(400)
          .send({ success: false, error: 'Username and password required' });
      }

      if (requestedPermission !== 'view' && requestedPermission !== 'edit') {
        return reply
          .status(400)
          .send({ success: false, error: 'Permission must be "view" or "edit"' });
      }

      const allUsers = getAllUsers();
      const isFirstUser = allUsers.length === 0;

      // If users already exist, require auth + edit permission
      if (!isFirstUser) {
        const token = request.cookies?.token;
        if (!token) {
          return reply
            .status(401)
            .send({ error: 'Authentication required' });
        }

        let payload;
        try {
          payload = verifyToken(token);
        } catch {
          return reply
            .status(401)
            .send({ error: 'Authentication required' });
        }

        if (payload.permission !== 'edit') {
          return reply
            .status(403)
            .send({ error: 'Edit permission required to create users' });
        }
      }

      // Check if username already exists
      const existing = getUserByUsername(username);
      if (existing) {
        return reply
          .status(400)
          .send({ success: false, error: 'Username already exists' });
      }

      // First user always gets 'edit'; subsequent users get requested permission
      const finalPermission = isFirstUser ? 'edit' : requestedPermission;

      const passwordHash = hashPassword(password);
      const userId = createUser(username, passwordHash, finalPermission);

      return {
        success: true,
        user_id: userId,
        permission: finalPermission,
        is_first_user: isFirstUser,
      };
    } catch (error) {
      request.log.error(error, 'Register error');
      return reply
        .status(500)
        .send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/auth/init ───────────────────────────────────────────────
  app.post('/init', async (request, reply) => {
    try {
      const body = request.body as {
        username?: string;
        password?: string;
      };
      const { username, password } = body;

      if (!username || !password) {
        return reply
          .status(400)
          .send({ success: false, error: 'Username and password required' });
      }

      const allUsers = getAllUsers();
      if (allUsers.length > 0) {
        return reply.status(400).send({
          success: false,
          error:
            'Users already exist. Use /api/auth/register after logging in.',
        });
      }

      // Check if username already exists
      const existing = getUserByUsername(username);
      if (existing) {
        return reply
          .status(400)
          .send({ success: false, error: 'Username already exists' });
      }

      const passwordHash = hashPassword(password);
      createUser(username, passwordHash, 'edit');

      return {
        success: true,
        message: 'Admin user created',
      };
    } catch (error) {
      request.log.error(error, 'Init error');
      return reply
        .status(500)
        .send({ success: false, error: 'Internal server error' });
    }
  });
}
