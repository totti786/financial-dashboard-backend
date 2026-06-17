// ============================================================================
// Carpentry Routes — REST API for carpentry income & expense management
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import {
  getCarpentryData,
  addIncome,
  updateIncome,
  deleteIncome,
  addExpense,
  updateExpense,
  deleteExpense,
} from '../services/carpentry.service.js';

/**
 * Insert an audit log record for a write operation.
 */
function auditLog(
  request: { user?: { userId?: number; username?: string }; ip?: string; headers?: Record<string, string | string[] | undefined> },
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
) {
  const db = getDb();
  const userId = request.user?.userId ?? null;
  const username = request.user?.username ?? null;
  const ipAddress = request.ip ?? null;
  const userAgent = (request.headers?.['user-agent'] as string) ?? null;

  db.prepare(
    `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, username, action, entityType, entityId, JSON.stringify(details), ipAddress, userAgent);
}

export async function carpentryRoutes(app: FastifyInstance) {
  // ── GET /api/carpentry — returns all carpentry data ─────────────────────
  app.get('/', { preHandler: [requirePermission('edit')] }, async (_request, reply) => {
    try {
      const data = getCarpentryData();
      return reply.send({ success: true, ...data });
    } catch (error) {
      _request.log.error(error, 'Error fetching carpentry data');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/carpentry/income/add ──────────────────────────────────────
  app.post('/income/add', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as {
        amount?: number;
        description?: string;
        date?: string;
      };

      if (!body.amount || !body.description || !body.date) {
        return reply.status(400).send({ success: false, error: 'amount, description, and date are required' });
      }

      const record = addIncome(body.amount, body.description, body.date);

      auditLog(
        request,
        'add',
        'carpentry_income',
        String(record.row_number),
        { amount: body.amount, description: body.description, date: body.date },
      );

      return reply.send({ success: true, record });
    } catch (error) {
      request.log.error(error, 'Error adding carpentry income');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/carpentry/income/update ───────────────────────────────────
  app.post('/income/update', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as {
        row_number?: number;
        amount?: number;
        description?: string;
        date?: string;
      };

      if (!body.row_number || !body.amount || !body.description || !body.date) {
        return reply.status(400).send({ success: false, error: 'row_number, amount, description, and date are required' });
      }

      const record = updateIncome(body.row_number, body.amount, body.description, body.date);

      auditLog(
        request,
        'update',
        'carpentry_income',
        String(body.row_number),
        { amount: body.amount, description: body.description, date: body.date },
      );

      return reply.send({ success: true, record });
    } catch (error) {
      request.log.error(error, 'Error updating carpentry income');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/carpentry/income/delete ───────────────────────────────────
  app.post('/income/delete', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as { row_number?: number };

      if (!body.row_number) {
        return reply.status(400).send({ success: false, error: 'row_number is required' });
      }

      deleteIncome(body.row_number);

      auditLog(
        request,
        'delete',
        'carpentry_income',
        String(body.row_number),
        { row_number: body.row_number },
      );

      return reply.send({ success: true, message: 'Income deleted' });
    } catch (error) {
      request.log.error(error, 'Error deleting carpentry income');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/carpentry/expense/add ─────────────────────────────────────
  app.post('/expense/add', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as {
        amount?: number;
        description?: string;
        date?: string;
        is_internal?: boolean;
        is_firas?: boolean;
      };

      if (!body.amount || !body.description || !body.date) {
        return reply.status(400).send({ success: false, error: 'amount, description, and date are required' });
      }

      const record = addExpense(
        body.amount,
        body.description,
        body.date,
        body.is_internal ?? false,
        body.is_firas ?? false,
      );

      auditLog(
        request,
        'add',
        'carpentry_expense',
        String(record.row_number),
        { amount: body.amount, description: body.description, date: body.date, is_internal: body.is_internal, is_firas: body.is_firas },
      );

      return reply.send({ success: true, record });
    } catch (error) {
      request.log.error(error, 'Error adding carpentry expense');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/carpentry/expense/update ──────────────────────────────────
  app.post('/expense/update', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as {
        row_number?: number;
        amount?: number;
        description?: string;
        date?: string;
        is_internal?: boolean;
      };

      if (!body.row_number || !body.amount || !body.description || !body.date) {
        return reply.status(400).send({ success: false, error: 'row_number, amount, description, and date are required' });
      }

      const record = updateExpense(
        body.row_number,
        body.amount,
        body.description,
        body.date,
        body.is_internal ?? false,
      );

      auditLog(
        request,
        'update',
        'carpentry_expense',
        String(body.row_number),
        { amount: body.amount, description: body.description, date: body.date, is_internal: body.is_internal },
      );

      return reply.send({ success: true, record });
    } catch (error) {
      request.log.error(error, 'Error updating carpentry expense');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // ── POST /api/carpentry/expense/delete ──────────────────────────────────
  app.post('/expense/delete', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as { row_number?: number };

      if (!body.row_number) {
        return reply.status(400).send({ success: false, error: 'row_number is required' });
      }

      deleteExpense(body.row_number);

      auditLog(
        request,
        'delete',
        'carpentry_expense',
        String(body.row_number),
        { row_number: body.row_number },
      );

      return reply.send({ success: true, message: 'Expense deleted' });
    } catch (error) {
      request.log.error(error, 'Error deleting carpentry expense');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
