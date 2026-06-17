// ============================================================================
// Admin Routes — config, user management, and audit log endpoints
// ============================================================================

import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/auth.js';
import {
  getConfig,
  updateConfig,
  getUsers,
  updateUser,
  deleteUser,
  getAuditEvents,
} from '../services/admin.service.js';
import { getDb } from '../db/index.js';

// ── Admin Config Routes (/api/admin) ────────────────────────────────────────

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/admin/config
  app.get('/config', { preHandler: [requirePermission('edit')] }, async (_request, reply) => {
    try {
      const config = getConfig();
      return reply.send({ success: true, config });
    } catch (error) {
      _request.log.error(error, 'Error fetching config');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // POST /api/admin/config
  app.post('/config', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const result = updateConfig(body);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Error updating config');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}

// ── User Management Routes (/api) ───────────────────────────────────────────

export async function userRoutes(app: FastifyInstance) {
  // GET /api/users
  app.get('/users', { preHandler: [requirePermission('edit')] }, async (_request, reply) => {
    try {
      const users = getUsers();
      return reply.send({ success: true, users });
    } catch (error) {
      _request.log.error(error, 'Error fetching users');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // PUT /api/users/:id
  app.put('/users/:id', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const userId = Number(params.id);
      if (Number.isNaN(userId)) {
        return reply.status(400).send({ success: false, error: 'Invalid user ID' });
      }

      const body = request.body as {
        username?: string;
        password?: string;
        permission?: string;
      };

      const result = updateUser(userId, body);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Error updating user');
      if (error instanceof Error && error.message === 'User not found') {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // DELETE /api/users/:id — cannot delete self
  app.delete('/users/:id', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const userId = Number(params.id);
      if (Number.isNaN(userId)) {
        return reply.status(400).send({ success: false, error: 'Invalid user ID' });
      }

      // Cannot delete self
      if (request.user?.userId === userId) {
        return reply.status(400).send({ success: false, error: 'Cannot delete your own account' });
      }

      deleteUser(userId);
      return reply.send({ success: true, message: 'User deleted' });
    } catch (error) {
      request.log.error(error, 'Error deleting user');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}

// ── Audit Log Routes (/api) ─────────────────────────────────────────────────

export async function auditRoutes(app: FastifyInstance) {
  // GET /api/audit
  app.get('/audit', { preHandler: [requirePermission('edit')] }, async (request, reply) => {
    try {
      const query = request.query as {
        limit?: string;
        offset?: string;
        entity_type?: string;
        action?: string;
        username?: string;
      };

      const events = getAuditEvents({
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
        entity_type: query.entity_type,
        action: query.action,
        username: query.username,
      });

      return reply.send({ success: true, events });
    } catch (error) {
      request.log.error(error, 'Error fetching audit events');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
