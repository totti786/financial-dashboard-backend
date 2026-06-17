import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// ── Werkzeug scrypt format ─────────────────────────────────────────────────
// Old format (Python werkzeug):  scrypt:<N>:<r>:<p>$<salt_hex>$<hash_hex>
// New format (compatible):       scrypt:<N>:<r>:<p>$<salt_hex>$<hash_hex>
//
// Default parameters (matching old werkzeug): N=32768, r=8, p=1, dklen=64

const SCRYPT_PREFIX = 'scrypt:';
const DEFAULT_N = 32768;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const DKLEN = 64;

/**
 * Parse a werkzeug-format scrypt hash string into its components.
 * Returns null if the hash doesn't match the expected format.
 *
 * @example
 *   parseScryptHash("scrypt:32768:8:1$abc123$def456")
 *   // => { N: 32768, r: 8, p: 1, salt: <Buffer ab c1 23>, hash: <Buffer de f4 56> }
 */
function parseScryptHash(
  hash: string,
): { N: number; r: number; p: number; salt: Buffer; hash: Buffer } | null {
  if (!hash.startsWith(SCRYPT_PREFIX)) return null;

  const afterPrefix = hash.slice(SCRYPT_PREFIX.length);
  const paramsEnd = afterPrefix.indexOf('$');
  if (paramsEnd === -1) return null;

  const paramsPart = afterPrefix.slice(0, paramsEnd);
  const rest = afterPrefix.slice(paramsEnd + 1);

  const saltEnd = rest.indexOf('$');
  if (saltEnd === -1) return null;

  const saltHex = rest.slice(0, saltEnd);
  const hashHex = rest.slice(saltEnd + 1);

  const params = paramsPart.split(':');
  if (params.length !== 3) return null;

  const N = Number(params[0]);
  const r = Number(params[1]);
  const p = Number(params[2]);

  if (Number.isNaN(N) || Number.isNaN(r) || Number.isNaN(p)) return null;

  return {
    N,
    r,
    p,
    salt: Buffer.from(saltHex, 'hex'),
    hash: Buffer.from(hashHex, 'hex'),
  };
}

/**
 * Verify a password against a werkzeug-format scrypt hash.
 * Handles both old (werkzeug) and new (compatible) format hashes.
 *
 * @param password - The plaintext password to check
 * @param hash - The stored hash string in werkzeug scrypt format
 * @returns true if the password matches, false otherwise
 */
export function verifyPassword(password: string, hash: string): boolean {
  const parsed = parseScryptHash(hash);
  if (!parsed) {
    // Unknown format — cannot verify
    return false;
  }

  const { N, r, p, salt, hash: expectedHash } = parsed;

  try {
    const derived = scryptSync(password, salt, DKLEN, { N, r, p });

    // Timing-safe comparison to prevent timing attacks
    if (derived.length !== expectedHash.length) return false;
    return timingSafeEqual(derived, expectedHash);
  } catch {
    return false;
  }
}

/**
 * Hash a password using werkzeug-compatible scrypt format.
 *
 * @param password - The plaintext password to hash
 * @returns A werkzeug-format scrypt hash string
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, DKLEN, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
  });

  const saltHex = salt.toString('hex');
  const hashHex = derived.toString('hex');

  return `scrypt:${DEFAULT_N}:${DEFAULT_R}:${DEFAULT_P}$${saltHex}$${hashHex}`;
}
