import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAiClient } from "./client.js";

describe("buildAiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa QwenProxy via API compatível com OpenAI", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "[CENA 1]\n\nRoteiro gerado",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = buildAiClient({
      apiKey: "test-key",
      baseUrl: "http://127.0.0.1:3001/v1",
      model: "test-model",
      provider: "qwenproxy",
    });

    await expect(client.generate("Crie um roteiro")).resolves.toBe(
      "[CENA 1]\n\nRoteiro gerado",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "test-model",
    });
  });

  it("usa o modelo anunciado pelo QwenProxy como padrão", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Roteiro gerado" } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const previousQwenModel = process.env.QWENPROXY_MODEL;
    const previousAiModel = process.env.AI_MODEL;
    delete process.env.QWENPROXY_MODEL;
    delete process.env.AI_MODEL;

    try {
      const client = buildAiClient({
        apiKey: "test-key",
        baseUrl: "http://127.0.0.1:3001/v1",
        provider: "qwenproxy",
      });

      await client.generate("Crie um roteiro");
    } finally {
      if (previousQwenModel === undefined) {
        delete process.env.QWENPROXY_MODEL;
      } else {
        process.env.QWENPROXY_MODEL = previousQwenModel;
      }

      if (previousAiModel === undefined) {
        delete process.env.AI_MODEL;
      } else {
        process.env.AI_MODEL = previousAiModel;
      }
    }

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "qwen3.7-plus",
    });
  });

  it("falha para AI_PROVIDER desconhecido em vez de cair em mock", () => {
    expect(() => buildAiClient({ provider: "desconhecido" })).toThrow(
      'Unsupported AI_PROVIDER "desconhecido"',
    );
  });
});
