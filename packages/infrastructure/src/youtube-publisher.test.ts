import * as fs from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { YoutubePublisherService } from "./youtube-publisher.js";

describe("YoutubePublisherService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads successfully in mock mode", async () => {
    const service = new YoutubePublisherService(true);
    const result = await service.publishVideo(
      "mock_access_token",
      "nonexistent-file.mp4",
      {
        title: "Test Video",
        description: "Test Description",
        tags: ["test", "video"],
      },
    );

    expect(result.videoId).toBe("mock_youtube_video_id_998877");
    expect(result.url).toBe(
      "https://www.youtube.com/watch?v=mock_youtube_video_id_998877",
    );
  });

  it("throws error if file does not exist in real mode", async () => {
    const service = new YoutubePublisherService();
    (service as unknown as { isMockMode: boolean }).isMockMode = false;

    await expect(
      service.publishVideo(
        "some_token",
        join(process.cwd(), "nonexistent-file-xyz.mp4"),
        {
          title: "Test Video",
          description: "Test Description",
          tags: ["test"],
        },
      ),
    ).rejects.toThrow("Video file not found at path");
  });

  it("uploads large videos using resumable chunks and resumes after interruption", async () => {
    const videoPath = join(
      process.cwd(),
      `.tmp/youtube-upload-${Date.now()}.mp4`,
    );
    fs.mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });
    fs.writeFileSync(videoPath, Buffer.from("ABCDEFGHIJ", "utf-8"));

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            Location: "https://upload.youtube.test/session-1",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: {
            Range: "bytes=0-3",
          },
        }),
      )
      .mockRejectedValueOnce(new Error("network interruption"))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: {
            Range: "bytes=0-3",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: {
            Range: "bytes=0-7",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "real_video_123" }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

    const service = new YoutubePublisherService(false, {
      chunkSizeBytes: 4,
      fetchImpl: fetchMock,
    });
    (service as unknown as { isMockMode: boolean }).isMockMode = false;

    try {
      const result = await service.publishVideo(
        "real_access_token",
        videoPath,
        {
          title: "Chunked Upload",
          description: "Upload with resume",
          tags: ["chunked", "resume"],
        },
      );

      expect(result).toEqual({
        videoId: "real_video_123",
        url: "https://www.youtube.com/watch?v=real_video_123",
      });

      expect(fetchMock).toHaveBeenCalledTimes(6);

      const startCall = fetchMock.mock.calls[0];
      expect(startCall?.[0]).toContain("uploadType=resumable");
      expect(startCall?.[1]?.method).toBe("POST");
      expect(startCall?.[1]?.headers).toMatchObject({
        Authorization: "Bearer real_access_token",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": "10",
        "X-Upload-Content-Type": "video/mp4",
      });

      const firstChunkCall = fetchMock.mock.calls[1];
      expect(firstChunkCall?.[1]?.method).toBe("PUT");
      expect(firstChunkCall?.[1]?.headers).toMatchObject({
        Authorization: "Bearer real_access_token",
        "Content-Length": "4",
        "Content-Type": "video/mp4",
        "Content-Range": "bytes 0-3/10",
      });
      expect(
        Buffer.from(firstChunkCall?.[1]?.body as Buffer).toString("utf-8"),
      ).toBe("ABCD");

      const statusProbeCall = fetchMock.mock.calls[3];
      expect(statusProbeCall?.[1]?.headers).toMatchObject({
        Authorization: "Bearer real_access_token",
        "Content-Length": "0",
        "Content-Range": "bytes */10",
      });

      const resumedChunkCall = fetchMock.mock.calls[4];
      expect(resumedChunkCall?.[1]?.headers).toMatchObject({
        "Content-Length": "4",
        "Content-Range": "bytes 4-7/10",
      });
      expect(
        Buffer.from(resumedChunkCall?.[1]?.body as Buffer).toString("utf-8"),
      ).toBe("EFGH");

      const finalChunkCall = fetchMock.mock.calls[5];
      expect(finalChunkCall?.[1]?.headers).toMatchObject({
        "Content-Length": "2",
        "Content-Range": "bytes 8-9/10",
      });
      expect(
        Buffer.from(finalChunkCall?.[1]?.body as Buffer).toString("utf-8"),
      ).toBe("IJ");
    } finally {
      fs.rmSync(videoPath, { force: true });
    }
  });
});
