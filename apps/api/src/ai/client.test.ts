import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAiClient } from "./client.js";

describe("buildAiClient", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.QWENPROXY_BASE_URL;
    delete process.env.QWENPROXY_API_KEY;
    delete process.env.QWENPROXY_MODEL;
    vi.restoreAllMocks();
  });

  it("uses qwenproxy by default with OpenAI-compatible payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: "[CENA 1]\n\nRoteiro vindo do Qwen" } },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env.QWENPROXY_BASE_URL = "http://127.0.0.1:3000";
    process.env.QWENPROXY_API_KEY = "local-key";
    process.env.QWENPROXY_MODEL = "qwen-plus";

    const client = buildAiClient();
    const result = await client.generate("roteiro teste");

    expect(result).toContain("Qwen");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:3000/v1/chat/completions",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer local-key",
      },
    });
  });

  it("uses mock provider only when configured explicitly", async () => {
    process.env.AI_PROVIDER = "mock";
    const client = buildAiClient();

    await expect(client.generate("tema: ciência")).resolves.toContain("[CENA");
  });

  it("throws when gemini is selected without API key", () => {
    process.env.AI_PROVIDER = "gemini";

    expect(() => buildAiClient()).toThrow(
      "GEMINI_API_KEY is required when AI_PROVIDER=gemini",
    );
  });

  it("throws for unsupported providers", () => {
    process.env.AI_PROVIDER = "unknown";

    expect(() => buildAiClient()).toThrow('Unsupported AI_PROVIDER "unknown"');
  });
});
