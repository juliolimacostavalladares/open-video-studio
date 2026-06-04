import Fastify from 'fastify';
import cors from '@fastify/cors';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { env } from './env.js';
import { initializeMinIO } from './lib/minio.js';
import { setupBullBoard } from './lib/bullboard.js';
import './lib/queue.js'; // Start background worker
import { prisma } from '@repo/database';

const fastify = Fastify({
  logger: true,
});

// Register dynamic CORS middleware
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow local development tools/testing or requests with no origin (like mobile/curl)
    if (!origin || env.allowedOrigins.length === 0 || env.allowedOrigins.includes(origin)) {
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
const port = env.PORT;
const host = '0.0.0.0'; // Bind to all network interfaces for containerization

try {
  // Automatic Migrations & Seeding in development
  if (env.NODE_ENV === 'development') {
    console.log('🔄 Running automatic database migrations & seeding in development...');
    try {
      const require = createRequire(import.meta.url);
      const dbPackageJsonPath = require.resolve('@repo/database/package.json');
      const dbPackagePath = path.dirname(dbPackageJsonPath);

      execSync('npx prisma migrate dev --skip-generate --skip-seed', {
        cwd: dbPackagePath,
        stdio: 'inherit',
      });
      console.log('✅ Migrations applied successfully.');

      execSync('npx prisma db seed', {
        cwd: dbPackagePath,
        stdio: 'inherit',
      });
      console.log('🌱 Database seeded successfully.');
    } catch (error) {
      console.error('❌ Failed to run auto migrations/seed:', error);
      process.exit(1);
    }
  }

  // Verify Database Connection (Prisma Client)
  console.log('Verifying database connection...');
  await prisma.$connect();
  console.log('✅ Database connected successfully!');

  // Initialize MinIO buckets and policies
  console.log('Initializing MinIO buckets...');
  await initializeMinIO();
  
  await fastify.listen({ port, host });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
