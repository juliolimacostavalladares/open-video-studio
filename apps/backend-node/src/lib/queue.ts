import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../env.js';

const redisUrl = env.REDIS_URL;

// Initialize Redis connection
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Configure Video Render Queue
export const videoRenderQueue = new Queue('video-render', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s retries
    },
    removeOnComplete: {
      age: 3600, // keep up to 1 hour
      count: 100, // limit to 100 jobs
    },
    removeOnFail: {
      age: 24 * 3600, // keep up to 24 hours
    },
  },
});

// Define Worker with strict concurrency of 1 active worker
export const videoRenderWorker = new Worker(
  'video-render',
  async (job) => {
    console.log(`Processing video render job ${job.id}: ${job.name}...`);
    // Render worker logic will be detailed in later sprints
    return { success: true };
  },
  {
    connection,
    concurrency: 1, // Enforce strict 1 worker active at a time
  }
);

// Graceful shutdown listener
process.on('SIGTERM', async () => {
  console.log('Shutting down BullMQ worker...');
  await videoRenderWorker.close();
  connection.disconnect();
});
