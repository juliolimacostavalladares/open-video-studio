import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
});

const _env = clientSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!_env.success) {
  console.error('❌ Invalid client environment variables:', JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Invalid client environment variables');
}

export const env = _env.data;
