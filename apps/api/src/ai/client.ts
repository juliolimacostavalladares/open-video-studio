/**
 * Cliente de IA configurável.
 *
 * Em produção usa a variável AI_PROVIDER para selecionar o provedor.
 * Suporta "gemini" (default) e "mock" (para testes sem chave).
 *
 * Contrato: recebe prompt string, retorna string.
 */

export interface AiClientOptions {
  provider?: string;
  apiKey?: string;
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
          contents: [{ parts: [{ text: prompt }] }]
        })
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
    }
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
    }
  };
}

export function buildAiClient(options: AiClientOptions = {}): AiClient {
  const provider = options.provider ?? process.env.AI_PROVIDER ?? "mock";

  if (provider === "gemini") {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    }

    return buildGeminiClient(apiKey);
  }

  // Default: mock — útil em desenvolvimento e testes
  return buildMockClient();
}
