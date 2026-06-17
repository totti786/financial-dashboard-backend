import jwt from 'jsonwebtoken';

// ── Types ──────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: number;
  username: string;
  permission: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Configuration ──────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ── Token operations ───────────────────────────────────────────────────────

/**
 * Generate an access token (15 min) and refresh token (7 days).
 */
export function generateTokens(payload: JwtPayload): TokenPair {
  const secret = getSecret();

  const accessToken = jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    secret,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );

  return { accessToken, refreshToken };
}

/**
 * Verify a JWT and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token: string): JwtPayload {
  const secret = getSecret();
  const decoded = jwt.verify(token, secret) as JwtPayload & { type?: string };
  return {
    userId: decoded.userId,
    username: decoded.username,
    permission: decoded.permission,
  };
}

/**
 * Refresh an existing token pair using a valid refresh token.
 * Throws if the refresh token is invalid or expired.
 */
export function refreshTokens(refreshToken: string): TokenPair {
  const secret = getSecret();

  const decoded = jwt.verify(refreshToken, secret) as JwtPayload & {
    type?: string;
  };

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return generateTokens({
    userId: decoded.userId,
    username: decoded.username,
    permission: decoded.permission,
  });
}
