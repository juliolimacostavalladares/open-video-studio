import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5433/open_video_studio_test?schema=public',
      NODE_ENV: 'test',
      REDIS_URL: 'redis://127.0.0.1:6379/2',
      PORT: '4001',
      ALLOWED_ORIGINS: 'http://localhost:3000',
    },
  },
});
