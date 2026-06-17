// ============================================================================
// Stream Routes — SSE endpoint for data version broadcasts
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { addClient, removeClient, getDataVersion } from '../services/data-version.service.js';

export async function streamRoutes(app: FastifyInstance) {
  // GET /api/stream — SSE endpoint
  app.get('/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial version
    const initial = getDataVersion();
    reply.raw.write(`data: ${JSON.stringify(initial)}\n\n`);

    // Heartbeat every 25s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    // Register client for version change broadcasts
    const send = (data: string) => {
      try {
        reply.raw.write(`data: ${data}\n\n`);
      } catch {
        // Client disconnected
      }
    };
    addClient(send);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      removeClient(send);
    });

    // Keep connection open
    return reply;
  });
}
