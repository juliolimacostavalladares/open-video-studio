const stopWords = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "que",
  "se",
  "sem",
  "um",
  "uma"
]);

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractTokens(value: string) {
  return normalizeToken(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

export interface SceneKeywordSource {
  script: string;
  title: string;
}

export function generateSceneKeywords(source: SceneKeywordSource, limit = 8) {
  const ranked = new Map<string, number>();

  for (const token of extractTokens(`${source.title} ${source.script}`)) {
    ranked.set(token, (ranked.get(token) ?? 0) + 1);
  }

  const sorted = Array.from(ranked.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return a[0].localeCompare(b[0]);
    })
    .map(([token]) => token)
    .slice(0, limit);

  if (sorted.length > 0) {
    return sorted;
  }

  const fallback = extractTokens(source.title).slice(0, Math.max(1, limit));
  return fallback.length > 0 ? fallback : ["cena"];
}
