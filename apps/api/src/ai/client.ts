/**
 * Cliente de IA configurável.
 *
 * Usa a variável AI_PROVIDER para selecionar o provedor.
 * Suporta "qwenproxy" (default) e "gemini".
 *
 * Contrato: recebe prompt string, retorna string.
 */

export interface AiClientOptions {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AiClient {
  generate(prompt: string): Promise<string>;
}

function buildGeminiClient(apiKey: string): AiClient {
  return {
    async generate(prompt: string): Promise<string> {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

      const response = await fetch(`${url}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

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

function buildQwenProxyClient(
  baseUrl: string,
  apiKey: string,
  model: string,
): AiClient {
  const normalizedBaseUrl = normalizeOpenAiCompatibleBaseUrl(baseUrl);

  return {
    async generate(prompt: string): Promise<string> {
      const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`QwenProxy API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };

      const text = data.choices?.[0]?.message?.content?.trim();

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
      // Extrai tema do prompt para gerar roteiro mock estruturado
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
    const baseUrl =
      options.baseUrl ??
      process.env.QWENPROXY_BASE_URL ??
      "http://127.0.0.1:3000/v1";
    const apiKey =
      options.apiKey ??
      process.env.QWENPROXY_API_KEY ??
      process.env.OPENAI_API_KEY ??
      "sk-no-key-required";
    const model = options.model ?? process.env.QWENPROXY_MODEL ?? "qwen-plus";

    return buildQwenProxyClient(baseUrl, apiKey, model);
  }

  if (provider === "gemini") {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    }

    return buildGeminiClient(apiKey);
  }

  if (provider === "mock") {
    return buildMockClient();
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${provider}". Expected "qwenproxy", "gemini" or "mock".`,
  );
}
