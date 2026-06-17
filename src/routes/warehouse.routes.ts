import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getInventory,
  addItem,
  updateItem,
  deleteItem,
} from '../services/warehouse.service.js';
import {
  AddWarehouseItemRequestSchema,
  UpdateWarehouseItemRequestSchema,
  DeleteWarehouseItemRequestSchema,
} from '../schemas/warehouse.schema.js';

export async function warehouseRoutes(app: FastifyInstance) {
  // ── GET /api/warehouse ─────────────────────────────────────────────────
  app.get(
    '/warehouse',
    { preHandler: [requireAuth] },
    async (_request, reply) => {
      try {
        const inventory = getInventory();
        return { success: true, inventory };
      } catch (error) {
        _request.log.error(error, 'Error fetching warehouse inventory');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/warehouse/add ───────────────────────────────────────────
  app.post(
    '/warehouse/add',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = AddWarehouseItemRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const {
          timber_type,
          length,
          width,
          thickness,
          number_of_blanks,
          value_per_cubic_meter,
          grade,
          location,
          notes,
        } = parsed.data;

        const result = addItem({
          timberType: timber_type,
          length,
          width,
          thickness,
          numberOfBlanks: number_of_blanks,
          valuePerCubicMeter: value_per_cubic_meter,
          grade,
          location,
          notes,
        });

        return { success: true, result };
      } catch (error) {
        request.log.error(error, 'Error adding warehouse item');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/warehouse/update ────────────────────────────────────────
  app.post(
    '/warehouse/update',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = UpdateWarehouseItemRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const {
          row_number,
          timber_type,
          length,
          width,
          thickness,
          number_of_blanks,
          value_per_cubic_meter,
          grade,
          location,
          notes,
        } = parsed.data;

        updateItem(row_number, {
          timberType: timber_type,
          length,
          width,
          thickness,
          numberOfBlanks: number_of_blanks,
          valuePerCubicMeter: value_per_cubic_meter,
          grade,
          location,
          notes,
        });

        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error updating warehouse item');
        if (error instanceof Error && error.message.includes('not found')) {
          return reply
            .status(404)
            .send({ success: false, error: error.message });
        }
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/warehouse/delete ────────────────────────────────────────
  app.post(
    '/warehouse/delete',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = DeleteWarehouseItemRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { row_number } = parsed.data;
        deleteItem(row_number);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error deleting warehouse item');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );
}
