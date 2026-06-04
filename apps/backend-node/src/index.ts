import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { initializeMinIO } from './lib/minio.js';
import { setupBullBoard } from './lib/bullboard.js';
import './lib/queue.js'; // Start background worker

// Load environment variables from .env
dotenv.config();

const fastify = Fastify({
  logger: true,
});

// Parse allowed origins from environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [];

// Register dynamic CORS middleware
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow local development tools/testing or requests with no origin (like mobile/curl)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed by CORS'), false);
  },
});

// Register protected admin queues dashboard
await setupBullBoard(fastify);

// Simple health check endpoint
fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Listen config
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const host = '0.0.0.0'; // Bind to all network interfaces for containerization

try {
  // Initialize MinIO buckets and policies
  console.log('Initializing MinIO buckets...');
  await initializeMinIO();
  
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
