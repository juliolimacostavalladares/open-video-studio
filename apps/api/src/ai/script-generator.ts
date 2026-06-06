/**
 * Serviço de geração de roteiro.
 *
 * Responsabilidades:
 * - Montar o prompt a partir dos metadados do projeto
 * - Chamar o cliente de IA
 * - Emitir telemetria script_start / script_end
 * - Retornar o texto do roteiro normalizado
 */

import type { AiClient } from "./client.js";

export interface ScriptGenerationInput {
  theme: string;
  tone: string;
  targetDuration: number;
}

export interface ScriptGenerationResult {
  rawScript: string;
  generatedAt: Date;
  durationMs: number;
}

export interface TelemetryEvent {
  event: "script_start" | "script_end";
  theme: string;
  tone: string;
  targetDuration: number;
  durationMs?: number;
  error?: string;
}

export type TelemetryEmitter = (event: TelemetryEvent) => void;

const defaultEmitter: TelemetryEmitter = (event) => {
  // Em produção substitua por Sentry, Datadog ou similar
  console.info("[telemetry]", JSON.stringify(event));
};

function buildPrompt(input: ScriptGenerationInput): string {
  return `Você é um roteirista especialista em vídeos verticais para YouTube.

Crie um roteiro estruturado para um vídeo com as seguintes características:
- Tema: ${input.theme}
- Tom: ${input.tone}
- Duração alvo: ${input.targetDuration} minutos

Regras obrigatórias:
1. Divida o roteiro em cenas usando o padrão [CENA 1], [CENA 2], etc.
2. Cada cena deve ter título e texto de narração.
3. Adapte o número de cenas à duração alvo (aproximadamente 1 cena por 2-3 minutos).
4. Mantenha o tom "${input.tone}" consistente em todo o roteiro.
5. O roteiro deve ser em português do Brasil.

Retorne apenas o roteiro, sem explicações adicionais.`;
}

export function normalizeScript(raw: string): string {
  return raw.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export async function generateScript(
  input: ScriptGenerationInput,
  aiClient: AiClient,
  emit: TelemetryEmitter = defaultEmitter
): Promise<ScriptGenerationResult> {
  const startMs = Date.now();

  emit({ event: "script_start", ...input });

  try {
    const prompt = buildPrompt(input);
    const raw = await aiClient.generate(prompt);
    const rawScript = normalizeScript(raw);
    const durationMs = Date.now() - startMs;

    emit({ event: "script_end", ...input, durationMs });

    return {
      rawScript,
      generatedAt: new Date(),
      durationMs
    };
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const message = error instanceof Error ? error.message : String(error);

    emit({ event: "script_end", ...input, durationMs, error: message });

    throw error;
  }
}
