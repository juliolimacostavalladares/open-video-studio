import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { loadWorkspaceConfig, type WorkspaceConfig } from "@repo/config";

export type TTSBackendErrorCode =
  | "TTS_BACKEND_INVALID_RESPONSE"
  | "TTS_BACKEND_OFFLINE"
  | "TTS_BACKEND_REQUEST_FAILED"
  | "TTS_BACKEND_TIMEOUT";

export interface TTSVoiceProfile {
  id: string;
  instructions?: string;
  provider?: string;
  providerVoiceId?: string;
  referenceText?: string;
  samplePath?: string;
}

export interface TTSBackendRequest {
  effectPreset?: string;
  language?: string;
  speed?: number;
  text: string;
  voiceProfile: TTSVoiceProfile;
}

export interface TTSAudioArtifact {
  audio: Buffer;
  audioDurationSeconds?: number;
  audioId?: string;
  audioPath?: string;
  contentType: string;
  format: "wav";
  generatedAt: Date;
}

export interface TTSBackend {
  synthesize(request: TTSBackendRequest): Promise<TTSAudioArtifact>;
}

export class TTSBackendError extends Error {
  readonly code: TTSBackendErrorCode;
  readonly provider: string;
  readonly retriable: boolean;
  readonly statusCode?: number;

  constructor(
    message: string,
    options: {
      cause?: unknown;
      code: TTSBackendErrorCode;
      provider: string;
      retriable: boolean;
      statusCode?: number;
    }
  ) {
    super(message, { cause: options.cause });
    this.code = options.code;
    this.name = "TTSBackendError";
    this.provider = options.provider;
    this.retriable = options.retriable;
    this.statusCode = options.statusCode;
  }
}

type FetchLike = typeof fetch;

export interface OmniVoiceStudioTTSBackendOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  generatePath?: string;
  timeoutMs?: number;
}

const provider = "omnivoice-studio";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, path: string) {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

function toOptionalHeaderNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function appendReferenceAudio(formData: FormData, voiceProfile: TTSVoiceProfile) {
  if (!voiceProfile.samplePath) {
    return;
  }

  const audio = await readFile(voiceProfile.samplePath);
  const file = new File([audio], basename(voiceProfile.samplePath), {
    type: "audio/wav"
  });

  formData.append("ref_audio", file);
}

function buildFormData(request: TTSBackendRequest) {
  const formData = new FormData();

  formData.append("text", request.text);

  if (request.language) {
    formData.append("language", request.language);
  }

  if (request.effectPreset) {
    formData.append("effect_preset", request.effectPreset);
  }

  if (request.speed !== undefined) {
    formData.append("speed", String(request.speed));
  }

  if (request.voiceProfile.providerVoiceId) {
    formData.append("profile_id", request.voiceProfile.providerVoiceId);
  }

  if (request.voiceProfile.referenceText) {
    formData.append("ref_text", request.voiceProfile.referenceText);
  }

  if (request.voiceProfile.instructions) {
    formData.append("instruct", request.voiceProfile.instructions);
  }

  return formData;
}

function normalizeError(error: unknown) {
  if (error instanceof TTSBackendError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new TTSBackendError("OmniVoice Studio request timed out", {
      cause: error,
      code: "TTS_BACKEND_TIMEOUT",
      provider,
      retriable: true
    });
  }

  if (error instanceof TypeError) {
    return new TTSBackendError("OmniVoice Studio is unavailable", {
      cause: error,
      code: "TTS_BACKEND_OFFLINE",
      provider,
      retriable: true
    });
  }

  return new TTSBackendError("OmniVoice Studio request failed", {
    cause: error,
    code: "TTS_BACKEND_REQUEST_FAILED",
    provider,
    retriable: false
  });
}

export class OmniVoiceStudioTTSBackend implements TTSBackend {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly generatePath: string;
  private readonly timeoutMs: number;

  constructor(
    options: OmniVoiceStudioTTSBackendOptions = {},
    config: WorkspaceConfig = loadWorkspaceConfig()
  ) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? config.omnivoiceBaseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.generatePath = options.generatePath ?? "/generate";
    this.timeoutMs = options.timeoutMs ?? config.omnivoiceTimeoutMs;
  }

  async synthesize(request: TTSBackendRequest): Promise<TTSAudioArtifact> {
    const formData = buildFormData(request);
    await appendReferenceAudio(formData, request.voiceProfile);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(joinUrl(this.baseUrl, this.generatePath), {
        body: formData,
        method: "POST",
        signal: controller.signal
      });

      if (!response.ok) {
        throw await this.toHttpError(response);
      }

      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      if (!contentType.startsWith("audio/")) {
        throw new TTSBackendError("OmniVoice Studio returned an invalid response", {
          code: "TTS_BACKEND_INVALID_RESPONSE",
          provider,
          retriable: false,
          statusCode: response.status
        });
      }

      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length === 0) {
        throw new TTSBackendError("OmniVoice Studio returned empty audio", {
          code: "TTS_BACKEND_INVALID_RESPONSE",
          provider,
          retriable: false,
          statusCode: response.status
        });
      }

      return {
        audio,
        audioDurationSeconds: toOptionalHeaderNumber(response.headers.get("x-audio-duration")),
        audioId: response.headers.get("x-audio-id") ?? undefined,
        audioPath: response.headers.get("x-audio-path") ?? undefined,
        contentType,
        format: "wav",
        generatedAt: new Date()
      };
    } catch (error) {
      throw normalizeError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async toHttpError(response: Response) {
    const body = await response.text();
    const message = body || `HTTP ${response.status}`;
    const retriable = response.status >= 500;

    return new TTSBackendError(`OmniVoice Studio request failed: ${message}`, {
      code: "TTS_BACKEND_REQUEST_FAILED",
      provider,
      retriable,
      statusCode: response.status
    });
  }
}
