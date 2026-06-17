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
  AddOtherRequestSchema,
  UpdateOtherRequestSchema,
  DeleteOtherRequestSchema,
} from '../schemas/supplier.schema.js';

// ============================================================================
// Other sheets — filtered from suppliers data
// ============================================================================

const OTHER_SHEETS = [
  'نضال دشلي',
  'كمال دشلي',
  'سامر دشلي',
  'ندوى دشلي',
  'محمد غزال',
];

export async function otherRoutes(app: FastifyInstance) {
  // ── GET /api/other ─────────────────────────────────────────────────────
  app.get(
    '/other',
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      try {
        const allSuppliers = getSuppliers();
        const filtered = allSuppliers.filter((s) =>
          OTHER_SHEETS.includes(s.name),
        );
        return { success: true, suppliers: filtered };
      } catch (error) {
        _request.log.error(error, 'Error fetching other entities');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/other/add ──────────────────────────────────────────────
  app.post(
    '/other/add',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = AddOtherRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { name, type, amount, description, date } = parsed.data;

        // Validate that name is in OTHER_SHEETS
        if (!OTHER_SHEETS.includes(name)) {
          return reply
            .status(400)
            .send({ success: false, error: 'Invalid entity name' });
        }

        const result = addSupplier(name, type, amount, description, date);
        return { success: true, result };
      } catch (error) {
        request.log.error(error, 'Error adding other entity');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/other/update ───────────────────────────────────────────
  app.post(
    '/other/update',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = UpdateOtherRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { name, row_number, transaction_type, amount, description, date } =
          parsed.data;

        // Validate that name is in OTHER_SHEETS
        if (!OTHER_SHEETS.includes(name)) {
          return reply
            .status(400)
            .send({ success: false, error: 'Invalid entity name' });
        }

        updateSupplier(name, row_number, transaction_type, amount, description, date);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error updating other entity');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/other/delete ───────────────────────────────────────────
  app.post(
    '/other/delete',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = DeleteOtherRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { name, row_number, transaction_type } = parsed.data;

        // Validate that name is in OTHER_SHEETS
        if (!OTHER_SHEETS.includes(name)) {
          return reply
            .status(400)
            .send({ success: false, error: 'Invalid entity name' });
        }

        deleteSupplier(name, row_number, transaction_type);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error deleting other entity');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );
}
