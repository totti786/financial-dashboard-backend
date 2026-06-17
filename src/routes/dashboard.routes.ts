import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardData } from '../services/dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // ── GET /api/data ──────────────────────────────────────────────────────
  app.get('/data', { preHandler: [requireAuth] }, async (_request, reply) => {
    try {
      const data = getDashboardData();
      return data;
    } catch (error) {
      console.error('[DASHBOARD] Error fetching dashboard data:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
