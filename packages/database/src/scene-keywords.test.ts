import { describe, expect, it } from "vitest";

import { generateSceneKeywords } from "./scene-keywords.js";

describe("generateSceneKeywords", () => {
  it("normalizes, deduplicates and ranks deterministic keywords", () => {
    expect(
      generateSceneKeywords({
        title: "Introdução à Inteligência Artificial",
        script: "A inteligência artificial explica modelos, dados e automação com dados."
      })
    ).toEqual(["artificial", "dados", "inteligencia", "automacao", "explica", "introducao", "modelos"]);
  });

  it("falls back when the script has no useful keywords", () => {
    expect(
      generateSceneKeywords({
        title: "Cena Final",
        script: "e de a o"
      })
    ).toEqual(["cena", "final"]);
  });
});
