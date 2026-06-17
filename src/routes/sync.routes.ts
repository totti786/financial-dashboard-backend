// ============================================================================
// Sync Routes — sync trigger, status, check, data-version, and monthly-sales
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import {
  getSyncStatus,
  triggerSync,
  checkSync,
} from '../services/sync.service.js';
import { getDataVersion } from '../services/data-version.service.js';

// ── Sync Routes (/api/sync) ─────────────────────────────────────────────────

export async function syncRoutes(app: FastifyInstance) {
  // POST /api/sync — trigger a sync
  app.post('/', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const result = triggerSync();
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Error triggering sync');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // GET /api/sync/status — returns sync status (no auth required)
  app.get('/status', async (_request, reply) => {
    try {
      const status = getSyncStatus();
      return reply.send({ success: true, ...status });
    } catch (error) {
      _request.log.error(error, 'Error fetching sync status');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // POST /api/sync/check — checks if sync is needed (no auth required)
  app.post('/check', async (_request, reply) => {
    try {
      const result = checkSync();
      return reply.send(result);
    } catch (error) {
      _request.log.error(error, 'Error checking sync');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}

// ── Data Version Routes (/api) ──────────────────────────────────────────────

export async function dataVersionRoutes(app: FastifyInstance) {
  // GET /api/data-version — returns data version (no auth required)
  app.get('/data-version', async (_request, reply) => {
    try {
      const dataVersion = getDataVersion();
      return reply.send({ success: true, ...dataVersion });
    } catch (error) {
      _request.log.error(error, 'Error fetching data version');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}

// ── Monthly Sales Routes (/api) ─────────────────────────────────────────────

export async function monthlySalesRoutes(app: FastifyInstance) {
  // GET /api/monthly-sales — returns monthly sales by year (requires auth)
  app.get('/monthly-sales', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const query = request.query as { year?: string };
      const db = getDb();

      let rows;
      if (query.year) {
        rows = db
          .prepare(
            'SELECT id, year, month_number, month_name, sales_amount FROM monthly_sales WHERE year = ? ORDER BY month_number',
          )
          .all(Number(query.year));
      } else {
        rows = db
          .prepare('SELECT id, year, month_number, month_name, sales_amount FROM monthly_sales ORDER BY year, month_number')
          .all();
      }

      return reply.send({ success: true, sales: rows });
    } catch (error) {
      request.log.error(error, 'Error fetching monthly sales');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
