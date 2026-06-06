export interface EstimatedDuration {
  min: number;
  max: number;
  average: number;
}

export function calculateEstimatedDuration(text: string | null): EstimatedDuration {
  if (!text || !text.trim()) {
    return { min: 0, max: 0, average: 0 };
  }

  // Remove marcações de cena do tipo [CENA X - Título]
  const cleanText = text.replace(/\[.*?\]/g, "").trim();
  if (!cleanText) {
    return { min: 0, max: 0, average: 0 };
  }

  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { min: 0, max: 0, average: 0 };
  }

  return {
    min: Math.round((wordCount / 150) * 60),
    max: Math.round((wordCount / 130) * 60),
    average: Math.round((wordCount / 140) * 60)
  };
}
