import { z } from "zod";

const workspaceConfigSchema = z.object({
  apiPort: z.number().int().positive(),
  appName: z.string().min(1),
  queueName: z.string().min(1),
  redisUrl: z.string().url(),
  storageAccessKey: z.string().min(1),
  storageBasePath: z.string().min(1),
  storageBucket: z.string().min(1),
  storageDriver: z.enum(["local", "s3"]),
  storageEndpoint: z.string().url().optional(),
  storageForcePathStyle: z.boolean(),
  storageRegion: z.string().min(1),
  storageSecretKey: z.string().min(1),
  webPort: z.number().int().positive()
});

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

export function loadWorkspaceConfig(env: NodeJS.ProcessEnv = process.env): WorkspaceConfig {
  return workspaceConfigSchema.parse({
    apiPort: parsePort(env.API_PORT, 4000),
    appName: env.APP_NAME ?? "Open Video Studio",
    queueName: env.QUEUE_NAME ?? "video-pipeline",
    redisUrl: env.REDIS_URL ?? "redis://127.0.0.1:6379",
    storageAccessKey: env.STORAGE_ACCESS_KEY ?? "minioadmin",
    storageBasePath: env.STORAGE_BASE_PATH ?? "storage",
    storageBucket: env.STORAGE_BUCKET ?? "open-video-studio",
    storageDriver: env.STORAGE_DRIVER === "s3" ? "s3" : "local",
    storageEndpoint: env.STORAGE_ENDPOINT ?? "http://127.0.0.1:9000",
    storageForcePathStyle: parseBoolean(env.STORAGE_FORCE_PATH_STYLE, true),
    storageRegion: env.STORAGE_REGION ?? "us-east-1",
    storageSecretKey: env.STORAGE_SECRET_KEY ?? "minioadmin",
    webPort: parsePort(env.WEB_PORT, 3000)
  });
}
