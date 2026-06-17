import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken } from '../services/auth.service.js';
import type { JwtPayload } from '../services/auth.service.js';

/**
 * Fastify preHandler: requires a valid JWT in the `token` cookie.
 *
 * On success, decodes the token and attaches the payload to `request.user`.
 * On failure, replies 401 and halts the request pipeline.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies?.token;

  if (!token) {
    reply.status(401).send({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyToken(token);
    request.user = payload;
  } catch {
    reply.status(401).send({ success: false, error: 'Authentication required' });
  }
}

/**
 * Fastify preHandler factory: requires a valid JWT AND a specific permission level.
 *
 * @param requiredPermission - The permission level required (e.g. 'edit')
 * @returns A Fastify preHandler function
 *
 * On auth failure: replies 401
 * On permission failure: replies 403
 */
export function requirePermission(requiredPermission: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const token = request.cookies?.token;

    if (!token) {
      reply.status(401).send({ success: false, error: 'Authentication required' });
      return;
    }

    let payload: JwtPayload;
    try {
      payload = verifyToken(token);
    } catch {
      reply.status(401).send({ success: false, error: 'Authentication required' });
      return;
    }

    if (payload.permission !== requiredPermission) {
      reply
        .status(403)
        .send({ success: false, error: 'Edit permission required' });
      return;
    }

    request.user = payload;
  };
}
