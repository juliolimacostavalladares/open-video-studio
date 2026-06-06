import { describe, expect, it } from "vitest";

import { loadWorkspaceConfig } from "./index.js";

describe("loadWorkspaceConfig", () => {
  it("loads the shared workspace configuration without error", () => {
    const config = loadWorkspaceConfig({
        API_PORT: "4100",
        APP_NAME: "Open Video Studio",
        QUEUE_NAME: "video-pipeline",
        REDIS_URL: "redis://127.0.0.1:6380",
        STORAGE_ACCESS_KEY: "minio",
        STORAGE_BASE_PATH: "tmp/storage",
        STORAGE_BUCKET: "open-video-studio-test",
        STORAGE_DRIVER: "s3",
        STORAGE_ENDPOINT: "http://127.0.0.1:9000",
        STORAGE_FORCE_PATH_STYLE: "false",
        STORAGE_REGION: "us-east-1",
        STORAGE_SECRET_KEY: "secret",
        WEB_PORT: "3100"
      });

    expect(config.queueName).toBe("video-pipeline");
    expect(config.redisUrl).toBe("redis://127.0.0.1:6380");
    expect(config.storageDriver).toBe("s3");
    expect(config.storageForcePathStyle).toBe(false);
  });
});
