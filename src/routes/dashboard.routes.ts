import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardData, getMonthlySales } from '../services/dashboard.service.js';

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

  // ── GET /api/monthly-sales ─────────────────────────────────────────────
  app.get('/monthly-sales', { preHandler: [requireAuth] }, async (_request, reply) => {
    try {
      const data = getMonthlySales();
      return { success: true, ...data };
    } catch (error) {
      console.error('[DASHBOARD] Error fetching monthly sales:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
