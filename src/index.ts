import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { transactionRoutes } from './routes/transactions.routes.js';
import { debtRoutes } from './routes/debts.routes.js';
import { supplierRoutes } from './routes/suppliers.routes.js';
import { otherRoutes } from './routes/other.routes.js';
import { rentRoutes } from './routes/rent.routes.js';
import { warehouseRoutes } from './routes/warehouse.routes.js';
import { carpentryRoutes } from './routes/carpentry.routes.js';
import { adminRoutes, userRoutes, auditRoutes } from './routes/admin.routes.js';
import { syncRoutes, dataVersionRoutes, monthlySalesRoutes } from './routes/sync.routes.js';
import { streamRoutes } from './routes/stream.routes.js';
import { bumpVersion } from './services/data-version.service.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
});
await app.register(cookie, { secret: process.env.COOKIE_SECRET || 'dev-secret' });
await app.register(healthRoutes, { prefix: '/api' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(dashboardRoutes, { prefix: '/api' });
await app.register(transactionRoutes, { prefix: '/api' });
await app.register(debtRoutes, { prefix: '/api' });
await app.register(supplierRoutes, { prefix: '/api' });
await app.register(otherRoutes, { prefix: '/api' });
await app.register(rentRoutes, { prefix: '/api' });
await app.register(warehouseRoutes, { prefix: '/api' });
await app.register(carpentryRoutes, { prefix: '/api/carpentry' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(userRoutes, { prefix: '/api' });
await app.register(auditRoutes, { prefix: '/api' });
await app.register(syncRoutes, { prefix: '/api/sync' });
await app.register(dataVersionRoutes, { prefix: '/api' });
await app.register(monthlySalesRoutes, { prefix: '/api' });
await app.register(streamRoutes, { prefix: '/api' });

// Bump data version after every successful mutation (POST/PUT/DELETE with 2xx)
app.addHook('onResponse', (request, reply, done) => {
  if (['POST', 'PUT', 'DELETE'].includes(request.method) && reply.statusCode >= 200 && reply.statusCode < 300) {
    bumpVersion();
  }
  done();
});

const port = Number(process.env.PORT) || 5000;
await app.listen({ port, host: '0.0.0.0' });
console.log(`Server running on port ${port}`);
