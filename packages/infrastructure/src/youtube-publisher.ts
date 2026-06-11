import * as fs from "node:fs";

const DEFAULT_UPLOAD_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_RECOVERY_ATTEMPTS = 3;

interface YoutubePublisherOptions {
  chunkSizeBytes?: number;
  fetchImpl?: typeof fetch;
}

interface ResumableUploadStatus {
  offset: number;
  result?: YoutubePublishResult;
}

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
  private isMockMode = process.env.YOUTUBE_MOCK_MODE === "true";
  private readonly chunkSizeBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(forceMock = false, options: YoutubePublisherOptions = {}) {
    if (forceMock) {
      this.isMockMode = true;
    }

    const envChunkSize = Number.parseInt(
      process.env.YOUTUBE_UPLOAD_CHUNK_SIZE_BYTES ?? "",
      10,
    );
    this.chunkSizeBytes =
      options.chunkSizeBytes ??
      (Number.isFinite(envChunkSize) && envChunkSize > 0
        ? envChunkSize
        : DEFAULT_UPLOAD_CHUNK_SIZE_BYTES);
    this.fetchImpl = options.fetchImpl ?? fetch;
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

    if (this.isMockMode && accessToken === "mock_access_token_quota_error") {
      console.log(
        `[YouTube Publisher] Mock Mode: Simulating quota exceeded error`,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      throw new YoutubeQuotaExceededError(
        "Limite de quota do YouTube excedido. O vídeo está disponível apenas para download.",
      );
    }

    if (this.isMockMode) {
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

    const videoStats = fs.statSync(videoPath);
    const contentType = "video/mp4";

    try {
      const uploadUrl = await this.startResumableUpload(
        accessToken,
        requestMetadata,
        videoStats.size,
        contentType,
      );
      const result = await this.uploadFileInChunks(
        uploadUrl,
        accessToken,
        videoPath,
        videoStats.size,
        contentType,
      );
      console.log(
        `[YouTube Publisher] Successfully uploaded video to YouTube with ID: ${result.videoId}`,
      );
      return result;
    } catch (error) {
      console.error(
        `[YouTube Publisher] Failed to upload video to YouTube:`,
        error,
      );
      throw error;
    }
  }

  private async startResumableUpload(
    accessToken: string,
    requestMetadata: object,
    fileSize: number,
    contentType: string,
  ): Promise<string> {
    const body = JSON.stringify(requestMetadata);
    const res = await this.fetchImpl(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "Content-Length": Buffer.byteLength(body, "utf-8").toString(),
          "X-Upload-Content-Length": fileSize.toString(),
          "X-Upload-Content-Type": contentType,
        },
        body,
      },
    );

    if (!res.ok) {
      await this.throwYoutubeError(res);
    }

    const uploadUrl = res.headers.get("Location");
    if (!uploadUrl) {
      throw new Error(
        "YouTube resumable upload session did not return a Location header",
      );
    }

    return uploadUrl;
  }

  private async uploadFileInChunks(
    uploadUrl: string,
    accessToken: string,
    videoPath: string,
    fileSize: number,
    contentType: string,
  ): Promise<YoutubePublishResult> {
    const fileHandle = await fs.promises.open(videoPath, "r");
    let offset = 0;
    let recoveryAttempts = 0;

    try {
      while (offset < fileSize) {
        const chunkSize = Math.min(this.chunkSizeBytes, fileSize - offset);
        const buffer = Buffer.allocUnsafe(chunkSize);
        const { bytesRead } = await fileHandle.read(
          buffer,
          0,
          chunkSize,
          offset,
        );

        if (bytesRead <= 0) {
          throw new Error(
            `Unexpected end of file while uploading YouTube video at byte offset ${offset}`,
          );
        }

        const chunk =
          bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead);
        const chunkEnd = offset + bytesRead - 1;

        try {
          const res = await this.fetchImpl(uploadUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Length": bytesRead.toString(),
              "Content-Type": contentType,
              "Content-Range": `bytes ${offset}-${chunkEnd}/${fileSize}`,
            },
            body: chunk,
          });

          if (res.status === 308) {
            offset = this.nextOffsetFromRange(res.headers.get("Range"));
            recoveryAttempts = 0;
            continue;
          }

          if (res.ok) {
            return this.parseSuccessfulUploadResponse(res);
          }

          if (this.isRetryableUploadStatus(res.status)) {
            const uploadStatus = await this.recoverUploadStatus(
              uploadUrl,
              accessToken,
              fileSize,
              recoveryAttempts,
            );
            if (uploadStatus.result) {
              return uploadStatus.result;
            }
            offset = uploadStatus.offset;
            recoveryAttempts += 1;
            continue;
          }

          await this.throwYoutubeError(res);
        } catch (error) {
          if (recoveryAttempts >= DEFAULT_MAX_RECOVERY_ATTEMPTS) {
            throw error;
          }

          const uploadStatus = await this.recoverUploadStatus(
            uploadUrl,
            accessToken,
            fileSize,
            recoveryAttempts,
          );
          if (uploadStatus.result) {
            return uploadStatus.result;
          }
          offset = uploadStatus.offset;
          recoveryAttempts += 1;
        }
      }
    } finally {
      await fileHandle.close();
    }

    throw new Error(
      "YouTube upload session ended before returning the final video resource",
    );
  }

  private async recoverUploadStatus(
    uploadUrl: string,
    accessToken: string,
    fileSize: number,
    recoveryAttempts: number,
  ): Promise<ResumableUploadStatus> {
    if (recoveryAttempts >= DEFAULT_MAX_RECOVERY_ATTEMPTS) {
      throw new Error(
        "YouTube resumable upload exceeded the maximum recovery attempts",
      );
    }

    const res = await this.fetchImpl(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": "0",
        "Content-Range": `bytes */${fileSize}`,
      },
    });

    if (res.status === 308) {
      return { offset: this.nextOffsetFromRange(res.headers.get("Range")) };
    }

    if (res.ok) {
      return {
        offset: fileSize,
        result: await this.parseSuccessfulUploadResponse(res),
      };
    }

    await this.throwYoutubeError(res);
    throw new Error("Unreachable YouTube upload recovery state");
  }

  private nextOffsetFromRange(rangeHeader: string | null): number {
    if (!rangeHeader) {
      return 0;
    }

    const matched = /(\d+)-(\d+)$/.exec(rangeHeader);
    if (!matched) {
      throw new Error(
        `Invalid YouTube resumable upload range header: ${rangeHeader}`,
      );
    }

    const endByte = matched[2];
    if (!endByte) {
      throw new Error(
        `Invalid YouTube resumable upload range header: ${rangeHeader}`,
      );
    }

    return Number.parseInt(endByte, 10) + 1;
  }

  private isRetryableUploadStatus(status: number): boolean {
    return (
      status === 308 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    );
  }

  private async parseSuccessfulUploadResponse(
    res: Response,
  ): Promise<YoutubePublishResult> {
    const data = (await res.json()) as { id?: string };
    if (!data.id) {
      throw new Error("YouTube upload completed without returning a video id");
    }

    return {
      videoId: data.id,
      url: `https://www.youtube.com/watch?v=${data.id}`,
    };
  }

  private async throwYoutubeError(res: Response): Promise<never> {
    const errorText = await res.text();
    console.error(
      `[YouTube Publisher] YouTube API error: ${res.statusText} (${res.status}) - ${errorText}`,
    );

    if (
      res.status === 403 &&
      (errorText.includes("quotaExceeded") || errorText.includes("quota"))
    ) {
      throw new YoutubeQuotaExceededError(
        "Limite de quota do YouTube excedido. O vídeo está disponível apenas para download.",
      );
    }

    if (res.status === 404) {
      throw new Error(
        "YouTube resumable upload session expired. Start a new upload.",
      );
    }

    throw new Error(
      `YouTube API returned ${res.status} ${res.statusText}: ${errorText}`,
    );
  }
}
