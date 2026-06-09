import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPipelineWorker } from "./queue.js";
import { prisma } from "@repo/database";
import { buildVideoTimeline } from "./timeline.js";
import { renderVideo } from "./renderer.js";
import { createStorageService } from "./storage.js";
import { readFile, rm } from "node:fs/promises";

import type { Job, Processor } from "bullmq";

type TestJob = Job<unknown, unknown, string>;

let capturedProcessor: Processor<unknown, unknown, string>;

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn(),
    QueueEvents: vi.fn(),
    Worker: vi.fn().mockImplementation(function (
      this: { close: () => Promise<void> },
      _name: string,
      processor: Processor<unknown, unknown, string>,
    ) {
      capturedProcessor = processor;
      this.close = vi.fn().mockResolvedValue(undefined);
      return this;
    }),
  };
});

vi.mock("@repo/database", () => {
  return {
    prisma: {
      renderJob: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      project: {
        update: vi.fn(),
      },
    },
  };
});

vi.mock("./renderer.js", () => ({
  renderVideo: vi.fn(),
}));

vi.mock("./timeline.js", () => ({
  buildVideoTimeline: vi.fn(),
}));

vi.mock("./storage.js", () => {
  const mockStorage = {
    putObject: vi.fn(),
  };
  return {
    createStorageService: vi.fn().mockReturnValue(mockStorage),
  };
});

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  rm: vi.fn(),
}));

describe("Pipeline Worker - Render Job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Initialize the worker to capture the processor
    createPipelineWorker();
  });

  it("throws error if render job is not found in database", async () => {
    vi.mocked(prisma.renderJob.findUnique).mockResolvedValue(null);

    const job = {
      data: {
        target: "render" as const,
        referenceId: "non-existent-job-id",
      },
    };

    await expect(capturedProcessor(job as unknown as TestJob)).rejects.toThrow(
      "RenderJob non-existent-job-id not found",
    );
  });

  it("processes render job successfully and updates statuses", async () => {
    const mockRenderJob = {
      id: "job-1",
      projectId: "project-1",
      status: "queued" as const,
      outputPath: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.renderJob.findUnique).mockResolvedValue(mockRenderJob);
    vi.mocked(prisma.renderJob.update).mockResolvedValue(mockRenderJob);
    vi.mocked(prisma.project.update).mockResolvedValue({} as never);

    vi.mocked(buildVideoTimeline).mockResolvedValue({ scenes: [] });
    vi.mocked(renderVideo).mockResolvedValue();
    vi.mocked(readFile).mockResolvedValue(Buffer.from("rendered-video-bytes"));
    vi.mocked(rm).mockResolvedValue();

    const mockStorage = createStorageService();
    vi.mocked(mockStorage.putObject).mockResolvedValue({
      body: Buffer.from("rendered-video-bytes"),
      contentType: "video/mp4",
      key: "renders/render-project-1-job-1.mp4",
    });

    const job = {
      data: {
        target: "render" as const,
        referenceId: "job-1",
      },
    };

    const result = await capturedProcessor(job as unknown as TestJob);

    expect(result).toEqual({
      message: "Render job job-1 completed",
      status: "succeeded",
    });

    // Check status updates to running/rendering
    expect(prisma.renderJob.update).toHaveBeenNthCalledWith(1, {
      where: { id: "job-1" },
      data: { status: "running" },
    });
    expect(prisma.project.update).toHaveBeenNthCalledWith(1, {
      where: { id: "project-1" },
      data: { status: "rendering" },
    });

    // Check rendering triggers
    expect(buildVideoTimeline).toHaveBeenCalledWith(
      "project-1",
      expect.any(String),
    );
    expect(renderVideo).toHaveBeenCalled();

    // Check storage upload
    expect(mockStorage.putObject).toHaveBeenCalledWith(
      "renders",
      "render-project-1-job-1.mp4",
      Buffer.from("rendered-video-bytes"),
      "video/mp4",
    );

    // Check status updates to succeeded/ready_for_review
    expect(prisma.renderJob.update).toHaveBeenNthCalledWith(2, {
      where: { id: "job-1" },
      data: {
        status: "succeeded",
        outputPath: "renders/render-project-1-job-1.mp4",
      },
    });
    expect(prisma.project.update).toHaveBeenNthCalledWith(2, {
      where: { id: "project-1" },
      data: { status: "ready_for_review" },
    });
  });

  it("handles render failure, updates status to failed/error and rethrows", async () => {
    const mockRenderJob = {
      id: "job-1",
      projectId: "project-1",
      status: "queued" as const,
      outputPath: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.renderJob.findUnique).mockResolvedValue(mockRenderJob);
    vi.mocked(prisma.renderJob.update).mockResolvedValue(mockRenderJob);
    vi.mocked(prisma.project.update).mockResolvedValue({} as never);

    vi.mocked(buildVideoTimeline).mockRejectedValue(
      new Error("Timeline build failed"),
    );
    vi.mocked(rm).mockResolvedValue();

    const job = {
      data: {
        target: "render" as const,
        referenceId: "job-1",
      },
    };

    await expect(capturedProcessor(job as unknown as TestJob)).rejects.toThrow(
      "Timeline build failed",
    );

    // Check status updates to running/rendering
    expect(prisma.renderJob.update).toHaveBeenNthCalledWith(1, {
      where: { id: "job-1" },
      data: { status: "running" },
    });
    expect(prisma.project.update).toHaveBeenNthCalledWith(1, {
      where: { id: "project-1" },
      data: { status: "rendering" },
    });

    // Check status updates to failed/error
    expect(prisma.renderJob.update).toHaveBeenNthCalledWith(2, {
      where: { id: "job-1" },
      data: {
        status: "failed",
        errorMessage: "Timeline build failed",
      },
    });
    expect(prisma.project.update).toHaveBeenNthCalledWith(2, {
      where: { id: "project-1" },
      data: { status: "error" },
    });
  });
});
