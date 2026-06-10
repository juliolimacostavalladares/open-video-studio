import { randomBytes } from "node:crypto";

// Isolate Redis queue name per test execution to prevent cross-test interference
const uniqueId = `${process.pid}-${randomBytes(4).toString("hex")}`;
process.env.QUEUE_NAME = `video-pipeline-test-${uniqueId}`;
process.env.ASSET_PROVIDER = "mock";

console.log(
  `[TEST SETUP] Configured isolated Redis queue: ${process.env.QUEUE_NAME}`,
);
