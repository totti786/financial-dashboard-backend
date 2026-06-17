import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transaction.service.js';

export async function transactionRoutes(app: FastifyInstance) {
  // ── GET /api/transactions ──────────────────────────────────────────────
  app.get('/transactions', { preHandler: [requireAuth] }, async (_request, reply) => {
    try {
      const data = getTransactions();
      return data;
    } catch (error) {
      console.error('[TRANSACTIONS] Error fetching transactions:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /api/transactions/add ─────────────────────────────────────────
  app.post(
    '/transactions/add',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          type?: string;
          amount?: number;
          description?: string;
          date?: string;
        };
        const { type, amount, description, date } = body;

        if (!type || !amount || !description || !date) {
          return reply
            .status(400)
            .send({ success: false, error: 'Missing required fields' });
        }

        if (type !== 'income' && type !== 'expense') {
          return reply
            .status(400)
            .send({ success: false, error: 'type must be "income" or "expense"' });
        }

        const rowNumber = addTransaction(type, amount, description, date);

        return {
          success: true,
          message: 'Transaction added successfully',
          row_number: rowNumber,
        };
      } catch (error) {
        console.error('[TRANSACTIONS] Error adding transaction:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/transactions/update ──────────────────────────────────────
  app.post(
    '/transactions/update',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          type?: string;
          row_number?: number;
          amount?: number;
          description?: string;
          date?: string;
        };
        const { type, row_number, amount, description, date } = body;

        if (!type || row_number == null || !amount || !description || !date) {
          return reply
            .status(400)
            .send({ success: false, error: 'Missing required fields' });
        }

        if (type !== 'income' && type !== 'expense') {
          return reply
            .status(400)
            .send({ success: false, error: 'type must be "income" or "expense"' });
        }

        updateTransaction(type, row_number, amount, description, date);

        return {
          success: true,
          message: 'Transaction updated successfully',
        };
      } catch (error) {
        console.error('[TRANSACTIONS] Error updating transaction:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/transactions/delete ──────────────────────────────────────
  app.post(
    '/transactions/delete',
    { preHandler: [requireAuth, requirePermission('edit')] },
    async (request, reply) => {
      try {
        const body = request.body as {
          type?: string;
          row_number?: number;
        };
        const { type, row_number } = body;

        if (!type || row_number == null) {
          return reply
            .status(400)
            .send({ success: false, error: 'Missing required fields' });
        }

        if (type !== 'income' && type !== 'expense') {
          return reply
            .status(400)
            .send({ success: false, error: 'type must be "income" or "expense"' });
        }

        deleteTransaction(type, row_number);

        return {
          success: true,
          message: 'Transaction deleted successfully',
        };
      } catch (error) {
        console.error('[TRANSACTIONS] Error deleting transaction:', error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );
}
