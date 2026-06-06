import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { OmniVoiceStudioTTSBackend, TTSBackendError } from "./tts.js";

describe("OmniVoiceStudioTTSBackend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes a successful OmniVoice Studio response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(Buffer.from("wav-binary"), {
        headers: {
          "content-type": "audio/wav",
          "x-audio-duration": "1.25",
          "x-audio-id": "abc123",
          "x-audio-path": "abc123.wav"
        },
        status: 200
      })
    );

    const backend = new OmniVoiceStudioTTSBackend({
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl
    });

    const artifact = await backend.synthesize({
      text: "Hello from OmniVoice",
      voiceProfile: {
        id: "voice-1",
        providerVoiceId: "omnivoice-profile-1"
      }
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/generate");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    const formData = options.body as FormData;
    expect(formData.get("text")).toBe("Hello from OmniVoice");
    expect(formData.get("profile_id")).toBe("omnivoice-profile-1");
    expect(artifact.audio.toString("utf-8")).toBe("wav-binary");
    expect(artifact.audioDurationSeconds).toBe(1.25);
    expect(artifact.audioId).toBe("abc123");
    expect(artifact.audioPath).toBe("abc123.wav");
    expect(artifact.contentType).toBe("audio/wav");
    expect(artifact.format).toBe("wav");
  });

  it("uploads a reference sample when no OmniVoice profile id exists", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "omnivoice-tts-"));
    const samplePath = join(tempDir, "sample.wav");
    await writeFile(samplePath, Buffer.from("sample-audio"));

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(Buffer.from("ok"), {
        headers: { "content-type": "audio/wav" },
        status: 200
      })
    );

    const backend = new OmniVoiceStudioTTSBackend({
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl
    });

    await backend.synthesize({
      text: "Preview clip",
      voiceProfile: {
        id: "voice-2",
        referenceText: "original text",
        samplePath
      }
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const formData = options.body as FormData;
    const uploaded = formData.get("ref_audio");

    expect(uploaded).toBeInstanceOf(File);
    expect((uploaded as File).name).toBe("sample.wav");
    expect(formData.get("ref_text")).toBe("original text");

    await rm(tempDir, { force: true, recursive: true });
  });

  it("normalizes timeout failures", async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url, options?: RequestInit) => {
      const signal = options?.signal as AbortSignal;

      return await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("This operation was aborted", "AbortError"));
        });
      });
    });

    const backend = new OmniVoiceStudioTTSBackend({
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl,
      timeoutMs: 10
    });

    await expect(
      backend.synthesize({
        text: "timeout",
        voiceProfile: { id: "voice-1", providerVoiceId: "profile-timeout" }
      })
    ).rejects.toMatchObject({
      code: "TTS_BACKEND_TIMEOUT",
      provider: "omnivoice-studio",
      retriable: true
    } satisfies Partial<TTSBackendError>);
  });

  it("normalizes offline failures", async () => {
    const backend = new OmniVoiceStudioTTSBackend({
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed"))
    });

    await expect(
      backend.synthesize({
        text: "offline",
        voiceProfile: { id: "voice-1", providerVoiceId: "profile-offline" }
      })
    ).rejects.toMatchObject({
      code: "TTS_BACKEND_OFFLINE",
      provider: "omnivoice-studio",
      retriable: true
    } satisfies Partial<TTSBackendError>);
  });
});
