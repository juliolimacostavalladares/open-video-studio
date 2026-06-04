import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { createRequire } from 'module';
import { env } from './env.js';
import { buildApp } from './app.js';
import { initializeMinIO } from './lib/minio.js';
import './lib/queue.js'; // Start background worker
import { prisma } from '@repo/database';

const app = await buildApp();

// Listen config
const port = env.PORT;
const host = '0.0.0.0'; // Bind to all network interfaces for containerization

try {
  // Automatic Migrations & Seeding in development
  if (env.NODE_ENV === 'development') {
    console.log(
      '🔄 Running automatic database migrations & seeding in development (asynchronous)...',
    );
    try {
      const require = createRequire(import.meta.url);
      const dbPackageJsonPath = require.resolve('@repo/database/package.json');
      const dbPackagePath = path.dirname(dbPackageJsonPath);

      const execAsync = promisify(exec);

      // Run prisma migrate deploy asynchronously to avoid event loop blocking
      const { stdout: migrateStdout, stderr: migrateStderr } = await execAsync(
        'npx prisma migrate deploy',
        {
          cwd: dbPackagePath,
        },
      );
      console.log(migrateStdout);
      if (migrateStderr) console.error(migrateStderr);
      console.log('✅ Migrations applied successfully.');

      const { stdout: seedStdout, stderr: seedStderr } = await execAsync(
        'npx prisma db seed',
        {
          cwd: dbPackagePath,
        },
      );
      console.log(seedStdout);
      if (seedStderr) console.error(seedStderr);
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

  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
