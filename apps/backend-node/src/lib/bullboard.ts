import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { FastifyAdapter } from '@bull-board/fastify';
import { videoRenderQueue } from './queue.js';
import basicAuth from '@fastify/basic-auth';
import type { FastifyInstance } from 'fastify';

export async function setupBullBoard(fastify: FastifyInstance) {
  // Register Basic Authentication plugin
  await fastify.register(basicAuth, {
    validate: async (username, password, _req, _reply) => {
      const expectedUsername = process.env.BULL_BOARD_USERNAME || 'admin';
      const expectedPassword = process.env.BULL_BOARD_PASSWORD || 'admin';
      if (username !== expectedUsername || password !== expectedPassword) {
        throw new Error('Unauthorized');
      }
    },
    authenticate: {
      realm: 'Bull Board Admin',
    },
  });

  // Setup Bull Board adapter
  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [new BullMQAdapter(videoRenderQueue)],
    serverAdapter,
  });

  serverAdapter.setBasePath('/admin/queues');

  // Register protected prefix route
  await fastify.register(async (securedInstance) => {
    // Apply basicAuth onRequest hook to this scope only and return 401 on failure
    securedInstance.addHook('onRequest', (req, reply, next) => {
      const auth = (securedInstance as unknown as {
        basicAuth: (req: unknown, reply: unknown, next: (err?: Error) => void) => void;
      }).basicAuth;
      
      auth(req, reply, (err) => {
        if (err) {
          reply.code(401)
            .header('WWW-Authenticate', 'Basic realm="Bull Board Admin"')
            .send({ error: 'Unauthorized', message: err.message });
        } else {
          next();
        }
      });
    });

    await securedInstance.register(serverAdapter.registerPlugin(), {
      prefix: '/admin/queues',
      basePath: '/admin/queues',
    });
  });
}
