/**
 * Parser de cenas a partir do roteiro estruturado.
 *
 * Reconhece marcações no formato: [CENA X] ou [CENA X - Título]
 * onde X é um número inteiro.
 *
 * Regras:
 * - Marcações sem número são ignoradas
 * - Cenas com número repetido mantêm a última ocorrência
 * - Cenas são reordenadas pelo número da marcação
 * - Marcações inválidas não corrompem o resultado
 * - Roteiro vazio retorna array vazio
 */

export interface ParsedScene {
  /** Número da cena conforme marcação (ex: 1, 2, 3) */
  sceneNumber: number;
  /** Título extraído da marcação ou gerado automaticamente */
  title: string;
  /** Texto da cena (após a marcação até a próxima ou fim) */
  script: string;
  /** Índice zero-based para uso em orderIndex do banco */
  orderIndex: number;
}

/**
 * Regex para reconhecer marcações de cena.
 *
 * Formatos aceitos:
 * - [CENA 1]
 * - [CENA 2 - Introdução]
 * - [cena 3] (case-insensitive)
 * - [CENA 10]
 *
 * Formatos rejeitados (sem corrupção):
 * - [CENA] — sem número
 * - [CENA A] — número não inteiro
 */
const SCENE_MARKER_REGEX = /^\[cena\s+(\d+)(?:\s*[-–]\s*(.+?))?\]\s*$/im;
const SCENE_SPLIT_REGEX = /\[cena\s+\d+(?:\s*[-–]\s*.+?)?\]/im;

/**
 * Divide o script em blocos usando marcações de cena como delimitadores.
 */
function splitBySceneMarkers(script: string): Array<{ marker: string; content: string }> {
  const blocks: Array<{ marker: string; content: string }> = [];

  // Divide o texto em linhas para processar marcadores
  const lines = script.split("\n");
  let currentMarker = "";
  let currentLines: string[] = [];
  let foundFirstMarker = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isMarker = SCENE_SPLIT_REGEX.test(trimmed);

    if (isMarker) {
      // Salva bloco anterior
      if (foundFirstMarker) {
        blocks.push({ marker: currentMarker, content: currentLines.join("\n").trim() });
        currentLines = [];
      }

      currentMarker = trimmed;
      foundFirstMarker = true;
    } else {
      currentLines.push(line);
    }
  }

  // Salva último bloco
  if (foundFirstMarker) {
    blocks.push({ marker: currentMarker, content: currentLines.join("\n").trim() });
  }

  return blocks;
}

/**
 * Faz parse de uma marcação de cena e extrai número e título.
 */
function parseMarker(marker: string): { sceneNumber: number; title: string } | null {
  const match = SCENE_MARKER_REGEX.exec(marker);

  if (!match) {
    return null;
  }

  const sceneNumber = parseInt(match[1] ?? "0", 10);
  const extractedTitle = match[2]?.trim();
  const title = extractedTitle ?? `Cena ${sceneNumber}`;

  return { sceneNumber, title };
}

/**
 * Faz o parse completo do rawScript e retorna array de cenas ordenadas.
 *
 * Garante:
 * - Idempotência: mesmo input → mesmo output
 * - Cenas duplicadas: mantém a última ocorrência
 * - Ordenação: pelo número da marcação
 * - Marcações inválidas: ignoradas silenciosamente
 * - Script vazio: retorna []
 */
export function parseScenes(rawScript: string): ParsedScene[] {
  if (!rawScript || !rawScript.trim()) {
    return [];
  }

  const blocks = splitBySceneMarkers(rawScript);
  const sceneMap = new Map<number, { title: string; script: string }>();

  for (const block of blocks) {
    const parsed = parseMarker(block.marker);

    if (!parsed) {
      // Marcação inválida — ignora silenciosamente
      continue;
    }

    // Última ocorrência sobrescreve duplicatas
    sceneMap.set(parsed.sceneNumber, {
      title: parsed.title,
      script: block.content
    });
  }

  // Ordena por número de cena e gera orderIndex sequencial
  const sorted = Array.from(sceneMap.entries()).sort(([a], [b]) => a - b);

  return sorted.map(([sceneNumber, { title, script }], index) => ({
    sceneNumber,
    title,
    script,
    orderIndex: index
  }));
}

/**
 * Reconstrói o rawScript a partir de cenas parseadas.
 * Útil para garantir idempotência após recomposição.
 */
export function composeScenesBackToScript(scenes: ParsedScene[]): string {
  return scenes
    .map((scene) => `[CENA ${scene.sceneNumber} - ${scene.title}]\n\n${scene.script}`)
    .join("\n\n");
}
