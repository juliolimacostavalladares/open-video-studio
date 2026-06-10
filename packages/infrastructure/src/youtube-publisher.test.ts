import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import { join } from "node:path";
import { YoutubePublisherService } from "./youtube-publisher.js";

describe("YoutubePublisherService", () => {
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
    // Force real mode by creating service with forceMock = false
    // But since no client ID is present, we need to mock properties or test the file exists check
    const service = new YoutubePublisherService();
    // Force isMockMode to false
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
});
