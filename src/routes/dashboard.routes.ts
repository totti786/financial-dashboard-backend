import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardData, getMonthlySales } from '../services/dashboard.service.js';
import { z } from 'zod';

const ReportingPeriodQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
}).refine((query) => (query.year === undefined) === (query.month === undefined), {
  message: 'year and month must be provided together',
});

export async function dashboardRoutes(app: FastifyInstance) {
  // ── GET /api/data ──────────────────────────────────────────────────────
  app.get('/data', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const query = ReportingPeriodQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ error: query.error.message });
      }
      const data = getDashboardData(query.data.year, query.data.month);
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
