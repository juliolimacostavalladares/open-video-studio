/**
 * Cliente de IA configurável.
 *
 * Usa a variável AI_PROVIDER para selecionar o provedor.
 * Suporta "qwenproxy" (default), "gemini" e "mock" para testes.
 *
 * Contrato: recebe prompt string, retorna string.
 */

export interface AiClientOptions {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface AiClient {
  generate(prompt: string): Promise<string>;
}

const DEFAULT_AI_TIMEOUT_MS = 60_000;
const DEFAULT_QWENPROXY_TIMEOUT_MS = 180_000;

function parseTimeout(
  value: number | string | undefined,
  defaultTimeoutMs = DEFAULT_AI_TIMEOUT_MS,
): number {
  const timeoutMs = Number(value ?? defaultTimeoutMs);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`AI timeout must be a positive number, received "${value}"`);
  }

  return timeoutMs;
}

async function fetchWithTimeout(
  providerName: string,
  timeoutMs: number,
  input: string,
  init: RequestInit,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (signal.aborted) {
      throw new Error(`${providerName} timed out after ${timeoutMs}ms`, {
        cause: error,
      });
    }

    throw error;
  }
}

function buildGeminiClient(apiKey: string, timeoutMs: number): AiClient {
  return {
    async generate(prompt: string): Promise<string> {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

      const response = await fetchWithTimeout(
        "Gemini",
        timeoutMs,
        `${url}?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Gemini returned empty response");
      }

      return text;
    },
  };
}

function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  if (!trimmed) {
    throw new Error(
      "QWENPROXY_BASE_URL is required when AI_PROVIDER=qwenproxy",
    );
  }

  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function buildQwenProxyClient(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}): AiClient {
  const baseUrl = normalizeOpenAiCompatibleBaseUrl(options.baseUrl);

  return {
    async generate(prompt: string): Promise<string> {
      const response = await fetchWithTimeout(
        "QwenProxy",
        options.timeoutMs,
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ content: prompt, role: "user" }],
            model: options.model,
            stream: false,
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`QwenProxy API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | null };
          text?: string;
        }>;
      };
      const text =
        data.choices?.[0]?.message?.content?.trim() ??
        data.choices?.[0]?.text?.trim();

      if (!text) {
        throw new Error("QwenProxy returned empty response");
      }

      return text;
    },
  };
}

function buildMockClient(): AiClient {
  return {
    async generate(prompt: string): Promise<string> {
      const themeMatch = /tema[:\s]+["']?([^"'\n,]+)/i.exec(prompt);
      const theme = themeMatch?.[1]?.trim() ?? "Tema Geral";

      return `[CENA 1] Introdução

Bem-vindo ao vídeo sobre ${theme}. Neste conteúdo você vai aprender os conceitos fundamentais de forma clara e objetiva.

[CENA 2] Desenvolvimento

Vamos aprofundar os principais pontos sobre ${theme}. Este tema é essencial para quem deseja entender melhor o assunto.

[CENA 3] Conclusão

Chegamos ao fim do nosso vídeo sobre ${theme}. Espero que tenha sido útil. Deixe seu like e se inscreva no canal!`;
    },
  };
}

export function buildAiClient(options: AiClientOptions = {}): AiClient {
  const provider = options.provider ?? process.env.AI_PROVIDER ?? "qwenproxy";

  if (provider === "qwenproxy") {
    return buildQwenProxyClient({
      apiKey:
        options.apiKey ??
        process.env.QWENPROXY_API_KEY ??
        process.env.AI_API_KEY ??
        process.env.OPENAI_API_KEY ??
        "sk-no-key-required",
      baseUrl:
        options.baseUrl ??
        process.env.QWENPROXY_BASE_URL ??
        process.env.AI_BASE_URL ??
        "http://127.0.0.1:3001/v1",
      model:
        options.model ??
        process.env.QWENPROXY_MODEL ??
        process.env.AI_MODEL ??
        "qwen3.7-plus",
      timeoutMs: parseTimeout(
        options.timeoutMs ??
          process.env.QWENPROXY_TIMEOUT_MS ??
          process.env.AI_TIMEOUT_MS,
        DEFAULT_QWENPROXY_TIMEOUT_MS,
      ),
    });
  }

  if (provider === "gemini") {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    }

    return buildGeminiClient(
      apiKey,
      parseTimeout(
        options.timeoutMs ??
          process.env.GEMINI_TIMEOUT_MS ??
          process.env.AI_TIMEOUT_MS,
      ),
    );
  }

  if (provider === "mock") {
    return buildMockClient();
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${provider}". Expected "qwenproxy", "gemini" or "mock".`,
  );
}
