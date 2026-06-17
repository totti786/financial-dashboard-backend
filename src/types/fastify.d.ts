import type { JwtPayload } from '../services/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
