import { loadWorkspaceConfig, type WorkspaceConfig } from "@repo/config";
import { Redis } from "ioredis";
import {
  Queue,
  QueueEvents,
  Worker,
  type Job,
  type Processor,
  type QueueOptions,
  type WorkerOptions,
} from "bullmq";

export const fakeSuccessJobName = "fake-success";
export const fakeFailureJobName = "fake-failure";
export const renderJobName = "render";

export type PipelineJobName =
  | typeof fakeSuccessJobName
  | typeof fakeFailureJobName
  | typeof renderJobName;

export type PipelineJobData = {
  target: "audio" | "asset" | "render";
  referenceId: string;
};

export type PipelineJobResult = {
  message: string;
  status: "succeeded";
};

type Logger = Pick<Console, "error" | "info">;

function createRedisConnection(config: WorkspaceConfig) {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export function createPipelineQueue(
  config: WorkspaceConfig = loadWorkspaceConfig(),
) {
  const connection = createRedisConnection(config);
  const queue = new Queue<PipelineJobData, PipelineJobResult, PipelineJobName>(
    config.queueName,
    {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    } satisfies QueueOptions,
  );

  return {
    queue,
    async close() {
      await queue.close();
      await connection.quit();
    },
  };
}

export function createPipelineQueueEvents(
  config: WorkspaceConfig = loadWorkspaceConfig(),
) {
  const connection = createRedisConnection(config);
  const queueEvents = new QueueEvents(config.queueName, {
    connection,
  });

  return {
    queueEvents,
    async close() {
      await queueEvents.close();
      await connection.quit();
    },
  };
}

function createFakeProcessor(
  logger: Logger,
): Processor<PipelineJobData, PipelineJobResult, PipelineJobName> {
  return async (
    job: Job<PipelineJobData, PipelineJobResult, PipelineJobName>,
  ) => {
    if (job.name === fakeFailureJobName) {
      logger.error(`pipeline job ${job.name} failed`, {
        jobId: job.id,
        referenceId: job.data.referenceId,
        target: job.data.target,
      });
      throw new Error(`Fake pipeline failure for ${job.data.referenceId}`);
    }

    logger.info(`pipeline job ${job.name} completed`, {
      jobId: job.id,
      referenceId: job.data.referenceId,
      target: job.data.target,
    });

    return {
      message: `Processed ${job.data.target}:${job.data.referenceId}`,
      status: "succeeded",
    };
  };
}

function createProcessor(
  config: WorkspaceConfig,
  logger: Logger,
): Processor<PipelineJobData, PipelineJobResult, PipelineJobName> {
  const fakeProcessor = createFakeProcessor(logger);

  return async (
    job: Job<PipelineJobData, PipelineJobResult, PipelineJobName>,
  ) => {
    if (job.name === renderJobName) {
      const { referenceId } = job.data;
      const { prisma } = await import("@repo/database");
      const { buildVideoTimeline } = await import("./timeline.js");
      const { renderVideo } = await import("./renderer.js");
      const { createStorageService } = await import("./storage.js");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { readFile, rm } = await import("node:fs/promises");

      const renderJob = await prisma.renderJob.findUnique({
        where: { id: referenceId },
      });

      if (!renderJob) {
        throw new Error(`RenderJob ${referenceId} not found`);
      }

      logger.info(
        `starting render job ${referenceId} for project ${renderJob.projectId}`,
      );

      await prisma.renderJob.update({
        where: { id: referenceId },
        data: { status: "running" },
      });
      await prisma.project.update({
        where: { id: renderJob.projectId },
        data: { status: "rendering" },
      });

      const tempFile = join(tmpdir(), `render-${referenceId}.mp4`);

      try {
        const apiUrl =
          process.env.API_INTERNAL_URL ?? `http://127.0.0.1:${config.apiPort}`;
        const timelineProps = await buildVideoTimeline(
          renderJob.projectId,
          apiUrl,
        );

        await renderVideo(timelineProps, tempFile);

        const videoBuffer = await readFile(tempFile);
        const storage = createStorageService(config);
        const relativeKey = `render-${renderJob.projectId}-${referenceId}.mp4`;
        const descriptor = await storage.putObject(
          "renders",
          relativeKey,
          videoBuffer,
          "video/mp4",
        );

        await rm(tempFile, { force: true });

        await prisma.renderJob.update({
          where: { id: referenceId },
          data: {
            status: "succeeded",
            outputPath: descriptor.key,
          },
        });
        await prisma.project.update({
          where: { id: renderJob.projectId },
          data: { status: "ready_for_review" },
        });

        logger.info(`render job ${referenceId} succeeded`);

        return {
          message: `Render job ${referenceId} completed`,
          status: "succeeded",
        };
      } catch (error) {
        await rm(tempFile, { force: true }).catch(() => {});
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error(`render job ${referenceId} failed: ${errorMessage}`);

        await prisma.renderJob.update({
          where: { id: referenceId },
          data: {
            status: "failed",
            errorMessage,
          },
        });
        await prisma.project.update({
          where: { id: renderJob.projectId },
          data: { status: "error" },
        });

        throw error;
      }
    }

    return fakeProcessor(job);
  };
}

export function createPipelineWorker(
  config: WorkspaceConfig = loadWorkspaceConfig(),
  logger: Logger = console,
) {
  const connection = createRedisConnection(config);
  const worker = new Worker<
    PipelineJobData,
    PipelineJobResult,
    PipelineJobName
  >(config.queueName, createProcessor(config, logger), {
    connection,
    concurrency: 1,
  } satisfies WorkerOptions);

  return {
    worker,
    async close() {
      await worker.close();
      await connection.quit();
    },
  };
}
