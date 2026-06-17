import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getSuppliers,
  getSupplierAllowlist,
  addSupplier,
  updateSupplier,
  deleteSupplier,
} from '../services/supplier.service.js';
import {
  AddSupplierRequestSchema,
  UpdateSupplierRequestSchema,
  DeleteSupplierRequestSchema,
} from '../schemas/supplier.schema.js';

export async function supplierRoutes(app: FastifyInstance) {
  // ── GET /api/suppliers ────────────────────────────────────────────────
  app.get(
    '/suppliers',
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      try {
        const suppliers = getSuppliers();
        return { success: true, suppliers };
      } catch (error) {
        _request.log.error(error, 'Error fetching suppliers');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── GET /api/suppliers/allowlist ──────────────────────────────────────
  app.get(
    '/suppliers/allowlist',
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      try {
        const suppliers = getSupplierAllowlist();
        return { success: true, suppliers };
      } catch (error) {
        _request.log.error(error, 'Error fetching supplier allowlist');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/suppliers/add ──────────────────────────────────────────
  app.post(
    '/suppliers/add',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = AddSupplierRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { supplier_name, type, amount, description, date } = parsed.data;
        const result = addSupplier(supplier_name, type, amount, description, date);
        return { success: true, result };
      } catch (error) {
        request.log.error(error, 'Error adding supplier transaction');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/suppliers/update ───────────────────────────────────────
  app.post(
    '/suppliers/update',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = UpdateSupplierRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const {
          supplier_name,
          row_number,
          transaction_type,
          amount,
          description,
          date,
        } = parsed.data;

        updateSupplier(
          supplier_name,
          row_number,
          transaction_type,
          amount,
          description,
          date,
        );
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error updating supplier transaction');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/suppliers/delete ───────────────────────────────────────
  app.post(
    '/suppliers/delete',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = DeleteSupplierRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { supplier_name, row_number, transaction_type } = parsed.data;
        deleteSupplier(supplier_name, row_number, transaction_type);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error deleting supplier transaction');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );
}
