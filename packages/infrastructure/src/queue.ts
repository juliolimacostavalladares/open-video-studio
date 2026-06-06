import { loadWorkspaceConfig, type WorkspaceConfig } from "@repo/config";
import IORedis from "ioredis";
import { Queue, QueueEvents, Worker, type Job, type Processor, type QueueOptions, type WorkerOptions } from "bullmq";

export const fakeSuccessJobName = "fake-success";
export const fakeFailureJobName = "fake-failure";

export type PipelineJobName = typeof fakeSuccessJobName | typeof fakeFailureJobName;

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
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
}

export function createPipelineQueue(config: WorkspaceConfig = loadWorkspaceConfig()) {
  const connection = createRedisConnection(config);
  const queue = new Queue<PipelineJobData, PipelineJobResult, PipelineJobName>(config.queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 100
    }
  } satisfies QueueOptions);

  return {
    queue,
    async close() {
      await queue.close();
      await connection.quit();
    }
  };
}

export function createPipelineQueueEvents(config: WorkspaceConfig = loadWorkspaceConfig()) {
  const connection = createRedisConnection(config);
  const queueEvents = new QueueEvents(config.queueName, {
    connection
  });

  return {
    queueEvents,
    async close() {
      await queueEvents.close();
      await connection.quit();
    }
  };
}

function createFakeProcessor(logger: Logger): Processor<PipelineJobData, PipelineJobResult, PipelineJobName> {
  return async (job: Job<PipelineJobData, PipelineJobResult, PipelineJobName>) => {
    if (job.name === fakeFailureJobName) {
      logger.error(`pipeline job ${job.name} failed`, {
        jobId: job.id,
        referenceId: job.data.referenceId,
        target: job.data.target
      });
      throw new Error(`Fake pipeline failure for ${job.data.referenceId}`);
    }

    logger.info(`pipeline job ${job.name} completed`, {
      jobId: job.id,
      referenceId: job.data.referenceId,
      target: job.data.target
    });

    return {
      message: `Processed ${job.data.target}:${job.data.referenceId}`,
      status: "succeeded"
    };
  };
}

export function createPipelineWorker(
  config: WorkspaceConfig = loadWorkspaceConfig(),
  logger: Logger = console
) {
  const connection = createRedisConnection(config);
  const worker = new Worker<PipelineJobData, PipelineJobResult, PipelineJobName>(
    config.queueName,
    createFakeProcessor(logger),
    {
      connection
    } satisfies WorkerOptions
  );

  return {
    worker,
    async close() {
      await worker.close();
      await connection.quit();
    }
  };
}
