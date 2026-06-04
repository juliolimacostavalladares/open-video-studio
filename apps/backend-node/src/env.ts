import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().default(''),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/open_video_studio?schema=public'),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379/1'),
  MINIO_ENDPOINT_INTERNAL: z.string().url().default('http://localhost:9000'),
  MINIO_ROOT_USER: z.string().default('minioadmin'),
  MINIO_ROOT_PASSWORD: z.string().default('minioadmin'),
  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().default('admin'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

export const env = {
  ..._env.data,
  allowedOrigins: _env.data.ALLOWED_ORIGINS
    ? _env.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [],
};
