import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getRentData,
  addRentee,
  updateRentee,
  updateRentMonth,
  deleteRentee,
} from '../services/rent.service.js';
import {
  AddRenteeRequestSchema,
  UpdateRenteeRequestSchema,
  UpdateRentMonthRequestSchema,
  DeleteRenteeRequestSchema,
} from '../schemas/rent.schema.js';
import { z } from 'zod';

const RentQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export async function rentRoutes(app: FastifyInstance) {
  // ── GET /api/rent ──────────────────────────────────────────────────────
  app.get(
    '/rent',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const query = RentQuerySchema.safeParse(request.query);
        if (!query.success) {
          return reply.status(400).send({ success: false, error: query.error.message });
        }
        const rentData = getRentData(query.data.year);
        return { success: true, rent_data: rentData };
      } catch (error) {
        request.log.error(error, 'Error fetching rent data');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/rent/add ────────────────────────────────────────────────
  app.post(
    '/rent/add',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = AddRenteeRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { rentee_name, rent_amount, year } = parsed.data;
        const result = addRentee(rentee_name, rent_amount, year);
        return { success: true, result };
      } catch (error) {
        request.log.error(error, 'Error adding rentee');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/rent/update ─────────────────────────────────────────────
  app.post(
    '/rent/update',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = UpdateRenteeRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { row_number, rentee_name, rent_amount } = parsed.data;

        if (!rentee_name && rent_amount === undefined) {
          return reply.status(400).send({
            success: false,
            error: 'Must provide rentee_name or rent_amount to update',
          });
        }

        updateRentee(row_number, rentee_name, rent_amount);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error updating rentee');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ── POST /api/rent/month ──────────────────────────────────────────────
  app.post(
    '/rent/month',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = UpdateRentMonthRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { row_number, year, month, is_paid, is_sham_cash } = parsed.data;

        if (month < 1 || month > 12) {
          return reply
            .status(400)
            .send({ success: false, error: 'Month must be between 1 and 12' });
        }

        updateRentMonth(row_number, year, month, is_paid, is_sham_cash);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error updating rent month');
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

  // ── POST /api/rent/delete ─────────────────────────────────────────────
  app.post(
    '/rent/delete',
    { preHandler: [requirePermission('edit')] },
    async (request, reply) => {
      try {
        const parsed = DeleteRenteeRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ success: false, error: parsed.error.message });
        }

        const { row_number } = parsed.data;
        deleteRentee(row_number);
        return { success: true };
      } catch (error) {
        request.log.error(error, 'Error deleting rentee');
        return reply
          .status(500)
          .send({ success: false, error: 'Internal server error' });
      }
    },
  );
}
