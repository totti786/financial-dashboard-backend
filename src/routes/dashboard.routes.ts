import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { finalizeMonthlySales, getDashboardData, getMonthlySales } from '../services/dashboard.service.js';
import { z } from 'zod';

const ReportingPeriodQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
}).refine((query) => (query.year === undefined) === (query.month === undefined), {
  message: 'year and month must be provided together',
});

const FinalizeMonthlySalesSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
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

  // ── POST /api/monthly-sales/finalize ───────────────────────────────────
  app.post('/monthly-sales/finalize', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const parsed = FinalizeMonthlySalesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: parsed.error.message });
      }
      const now = new Date();
      const requestedPeriod = parsed.data.year * 12 + parsed.data.month;
      const currentPeriod = now.getFullYear() * 12 + now.getMonth() + 1;
      if (requestedPeriod >= currentPeriod) {
        return reply.status(400).send({
          success: false,
          error: 'Only completed months can be finalized',
        });
      }
      const result = finalizeMonthlySales(
        parsed.data.year,
        parsed.data.month,
        request.user?.username ?? 'unknown',
      );
      return { success: true, result };
    } catch (error) {
      request.log.error(error, 'Error finalizing monthly sales');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
