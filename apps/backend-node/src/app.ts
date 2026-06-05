import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { setupBullBoard } from './lib/bullboard.js';
import { scriptRoutes } from './routes/script.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  // Register dynamic CORS middleware
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (
        !origin ||
        env.allowedOrigins.length === 0 ||
        env.allowedOrigins.includes(origin)
      ) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
  });

  // Register protected admin queues dashboard
  await setupBullBoard(fastify);

  // Register script generation routes
  await fastify.register(scriptRoutes, { prefix: '/api/script' });

  // Simple health check endpoint
  fastify.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}
