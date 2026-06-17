import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getDebts,
  addDebt,
  updateDebt,
  modifyDebtAmount,
  deleteDebt,
} from '../services/debt.service.js';

export async function debtRoutes(app: FastifyInstance) {
  // ── GET /api/debts ─────────────────────────────────────────────────────
  app.get('/debts', { preHandler: [requireAuth] }, async (_request, reply) => {
    try {
      const data = getDebts();
      return data;
    } catch (error) {
      console.error('[DEBTS] Error fetching debts:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /api/debts/add ────────────────────────────────────────────────
  app.post(
    '/debts/add',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          amount?: number;
          description?: string;
          date?: string;
        };
        const { amount, description, date } = body;

        if (!amount || !description || !date) {
          return reply
            .status(400)
            .send({ success: false, error: 'Missing required fields' });
        }

        const rowNumber = addDebt(amount, description, date);

        return {
          success: true,
          message: 'Debt added successfully',
          row_number: rowNumber,
        };
      } catch (error) {
        console.error('[DEBTS] Error adding debt:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/debts/update ─────────────────────────────────────────────
  app.post(
    '/debts/update',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          row_number?: number;
          amount?: number;
          description?: string;
          date?: string;
        };
        const { row_number, amount, description, date } = body;

        if (row_number == null || !amount || !description || !date) {
          return reply
            .status(400)
            .send({ success: false, error: 'Missing required fields' });
        }

        updateDebt(row_number, amount, description, date);

        return {
          success: true,
          message: 'Debt updated successfully',
        };
      } catch (error) {
        console.error('[DEBTS] Error updating debt:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/debts/pay ────────────────────────────────────────────────
  app.post(
    '/debts/pay',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          row_number?: number;
          description?: string;
          date?: string;
          original_amount?: number;
          payment_amount?: number;
        };
        const { row_number, description, date, original_amount, payment_amount } = body;

        if (payment_amount == null) {
          return reply
            .status(400)
            .send({ success: false, error: 'Missing required field: payment_amount' });
        }

        try {
          const newAmount = modifyDebtAmount(
            row_number,
            description,
            date,
            original_amount,
            payment_amount,
          );

          const action = payment_amount > 0 ? 'added to' : 'subtracted from';
          return {
            success: true,
            message: `${Math.abs(payment_amount)} ${action} debt successfully`,
            new_amount: newAmount,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Debt not found';
          return reply.status(404).send({ success: false, error: message });
        }
      } catch (error) {
        console.error('[DEBTS] Error paying debt:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/debts/delete ─────────────────────────────────────────────
  app.post(
    '/debts/delete',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          row_number?: number;
          description?: string;
          date?: string;
          original_amount?: number;
        };
        const { row_number, description, date, original_amount } = body;

        if (row_number == null && (!description || !date || original_amount == null)) {
          return reply.status(400).send({
            success: false,
            error:
              'Missing required fields (row_number or description, date, original_amount)',
          });
        }

        try {
          deleteDebt(row_number, description, date, original_amount);
          return {
            success: true,
            message: 'Debt deleted successfully',
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Debt not found';
          return reply.status(404).send({ success: false, error: message });
        }
      } catch (error) {
        console.error('[DEBTS] Error deleting debt:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );
}
