import * as fs from "node:fs";

export interface YoutubePublishMetadata {
  title: string;
  description: string;
  tags: string[];
  scheduledPublishAt?: Date;
}

export interface YoutubePublishResult {
  videoId: string;
  url: string;
}

export class YoutubeQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YoutubeQuotaExceededError";
  }
}

export class YoutubePublisherService {
  private isMockMode =
    !process.env.YOUTUBE_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_SECRET === "mock";

  constructor(forceMock = false) {
    if (forceMock) {
      this.isMockMode = true;
    }
  }

  async publishVideo(
    accessToken: string,
    videoPath: string,
    metadata: YoutubePublishMetadata,
  ): Promise<YoutubePublishResult> {
    console.log(
      `[YouTube Publisher] Starting upload for video at ${videoPath} with title "${metadata.title}"${
        metadata.scheduledPublishAt
          ? ` (Scheduled to ${metadata.scheduledPublishAt.toISOString()})`
          : ""
      }`,
    );

    if (accessToken === "mock_access_token_quota_error") {
      console.log(
        `[YouTube Publisher] Mock Mode: Simulating quota exceeded error`,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      throw new YoutubeQuotaExceededError(
        "Limite de quota do YouTube excedido. O vídeo está disponível apenas para download.",
      );
    }

    if (this.isMockMode || accessToken.startsWith("mock_access_token")) {
      console.log(`[YouTube Publisher] Mock Mode: Simulating upload success`);
      // Simulate small delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        videoId: "mock_youtube_video_id_998877",
        url: "https://www.youtube.com/watch?v=mock_youtube_video_id_998877",
      };
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at path: ${videoPath}`);
    }

    const boundary = "OVS_UPLOAD_BOUNDARY_" + Date.now();
    const requestMetadata = {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
      },
      status: metadata.scheduledPublishAt
        ? {
            privacyStatus: "private",
            publishAt: metadata.scheduledPublishAt.toISOString(),
          }
        : {
            privacyStatus: "unlisted", // Default to unlisted for OVS
          },
    };

    const metadataPart = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(requestMetadata),
      "",
    ].join("\r\n");

    const mediaHeader = [
      `--${boundary}`,
      "Content-Type: video/mp4",
      "",
      "",
    ].join("\r\n");

    const mediaFooter = `\r\n--${boundary}--\r\n`;

    const metadataBuffer = Buffer.from(metadataPart, "utf-8");
    const mediaHeaderBuffer = Buffer.from(mediaHeader, "utf-8");
    const mediaContentBuffer = fs.readFileSync(videoPath);
    const mediaFooterBuffer = Buffer.from(mediaFooter, "utf-8");

    const body = Buffer.concat([
      metadataBuffer,
      mediaHeaderBuffer,
      mediaContentBuffer,
      mediaFooterBuffer,
    ]);

    try {
      const res = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
            "Content-Length": body.length.toString(),
          },
          body,
        },
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error(
          `[YouTube Publisher] YouTube API error: ${res.statusText} (${res.status}) - ${errorText}`,
        );
        if (
          res.status === 403 &&
          (errorText.includes("quotaExceeded") || errorText.includes("quota"))
        ) {
          throw new YoutubeQuotaExceededError(
            `Limite de quota do YouTube excedido. O vídeo está disponível apenas para download.`,
          );
        }
        throw new Error(
          `YouTube API returned ${res.status} ${res.statusText}: ${errorText}`,
        );
      }

      const data = (await res.json()) as { id: string };
      console.log(
        `[YouTube Publisher] Successfully uploaded video to YouTube with ID: ${data.id}`,
      );

      return {
        videoId: data.id,
        url: `https://www.youtube.com/watch?v=${data.id}`,
      };
    } catch (error) {
      console.error(
        `[YouTube Publisher] Failed to upload video to YouTube:`,
        error,
      );
      throw error;
    }
  }
}
