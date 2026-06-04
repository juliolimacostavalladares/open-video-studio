import 'server-only';
import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  MINIO_ROOT_PASSWORD: z.string().optional(),
  BULL_BOARD_PASSWORD: z.string().optional(),
});

const _env = serverSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid server environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid server environment variables');
}

export const env = _env.data;
