import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    try {
      getDb().prepare('SELECT 1').get();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  });
}
