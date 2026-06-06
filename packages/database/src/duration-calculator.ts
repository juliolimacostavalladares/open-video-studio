/**
 * Helper para cálculo de duração estimada de vídeo a partir do roteiro.
 *
 * Utiliza a faixa de 130-150 palavras por minuto (PPM) recomendada no grooming.
 * Remove marcações estruturadas como [CENA X] antes de contar as palavras.
 */

export interface EstimatedDuration {
  min: number; // duração mínima em segundos
  max: number; // duração máxima em segundos
  average: number; // duração média em segundos
}

export function calculateEstimatedDuration(text: string | null): EstimatedDuration {
  if (!text || !text.trim()) {
    return { min: 0, max: 0, average: 0 };
  }

  // Remove marcações de cena do tipo [CENA X - Título] para não enviesar a contagem de falas
  const cleanText = text.replace(/\[.*?\]/g, "").trim();
  if (!cleanText) {
    return { min: 0, max: 0, average: 0 };
  }

  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { min: 0, max: 0, average: 0 };
  }

  // 150 PPM (mais rápido -> tempo menor)
  const minDuration = (wordCount / 150) * 60;
  // 130 PPM (mais devagar -> tempo maior)
  const maxDuration = (wordCount / 130) * 60;
  // 140 PPM (média)
  const averageDuration = (wordCount / 140) * 60;

  return {
    min: Math.round(minDuration),
    max: Math.round(maxDuration),
    average: Math.round(averageDuration)
  };
}
