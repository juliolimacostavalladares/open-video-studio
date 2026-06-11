import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAiClient } from "./client.js";

describe("buildAiClient", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    delete process.env.AI_TIMEOUT_MS;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_TIMEOUT_MS;
    delete process.env.OPENAI_API_KEY;
    delete process.env.QWENPROXY_API_KEY;
    delete process.env.QWENPROXY_BASE_URL;
    delete process.env.QWENPROXY_MODEL;
    delete process.env.QWENPROXY_TIMEOUT_MS;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("usa QwenProxy por padrão e normaliza a URL sem /v1", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Roteiro vindo do Qwen" } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.QWENPROXY_BASE_URL = "http://127.0.0.1:3001/";
    process.env.QWENPROXY_API_KEY = "local-key";

    const client = buildAiClient();

    await expect(client.generate("roteiro teste")).resolves.toBe(
      "Roteiro vindo do Qwen",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/v1/chat/completions",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer local-key",
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("envia payload OpenAI compatível com opções explícitas", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Roteiro gerado" } }],
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

    await client.generate("Crie um roteiro");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      messages: [{ content: "Crie um roteiro", role: "user" }],
      model: "test-model",
      stream: false,
    });
  });

  it("usa o modelo anunciado pelo QwenProxy como padrão", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Roteiro gerado" } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = buildAiClient({
      apiKey: "test-key",
      baseUrl: "http://127.0.0.1:3001/v1",
      provider: "qwenproxy",
    });
    await client.generate("Crie um roteiro");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "qwen3.7-plus",
    });
  });

  it("usa mock apenas quando configurado explicitamente", async () => {
    const client = buildAiClient({ provider: "mock" });

    await expect(client.generate("tema: ciência")).resolves.toContain("[CENA");
  });

  it("falha quando Gemini é selecionado sem chave", () => {
    expect(() => buildAiClient({ provider: "gemini" })).toThrow(
      "GEMINI_API_KEY is required when AI_PROVIDER=gemini",
    );
  });

  it("falha para provedores desconhecidos", () => {
    expect(() => buildAiClient({ provider: "desconhecido" })).toThrow(
      'Unsupported AI_PROVIDER "desconhecido"',
    );
  });
});
