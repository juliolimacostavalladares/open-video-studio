import { z } from "zod";

const workspaceConfigSchema = z.object({
  apiPort: z.number().int().positive(),
  appName: z.string().min(1),
  webPort: z.number().int().positive()
});

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadWorkspaceConfig(env: NodeJS.ProcessEnv = process.env): WorkspaceConfig {
  return workspaceConfigSchema.parse({
    apiPort: parsePort(env.API_PORT, 4000),
    appName: env.APP_NAME ?? "Open Video Studio",
    webPort: parsePort(env.WEB_PORT, 3000)
  });
}
