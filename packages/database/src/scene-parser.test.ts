import { describe, expect, it } from "vitest";

import { composeScenesBackToScript, parseScenes } from "./scene-parser.js";

describe("parseScenes — casos válidos", () => {
  it("retorna array vazio para script vazio", () => {
    expect(parseScenes("")).toEqual([]);
    expect(parseScenes("   ")).toEqual([]);
    expect(parseScenes("\n\n\n")).toEqual([]);
  });

  it("parseia uma cena simples", () => {
    const script = `[CENA 1]

Texto da primeira cena aqui.`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({
      sceneNumber: 1,
      title: "Cena 1",
      orderIndex: 0
    });
    expect(scenes[0]?.script).toContain("Texto da primeira cena");
  });

  it("parseia múltiplas cenas em ordem", () => {
    const script = `[CENA 1]

Introdução do vídeo.

[CENA 2]

Desenvolvimento do tema.

[CENA 3]

Conclusão e chamada para ação.`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(3);
    expect(scenes[0]?.sceneNumber).toBe(1);
    expect(scenes[1]?.sceneNumber).toBe(2);
    expect(scenes[2]?.sceneNumber).toBe(3);
    expect(scenes[0]?.orderIndex).toBe(0);
    expect(scenes[1]?.orderIndex).toBe(1);
    expect(scenes[2]?.orderIndex).toBe(2);
  });

  it("extrai título da marcação quando presente", () => {
    const script = `[CENA 1 - Introdução]

Bem-vindo ao vídeo!

[CENA 2 - Desenvolvimento]

Vamos aprender juntos.`;

    const scenes = parseScenes(script);

    expect(scenes[0]?.title).toBe("Introdução");
    expect(scenes[1]?.title).toBe("Desenvolvimento");
  });

  it("usa hífen longo como separador de título", () => {
    const script = `[CENA 1 – Título com hífen longo]

Texto aqui.`;

    const scenes = parseScenes(script);

    expect(scenes[0]?.title).toBe("Título com hífen longo");
  });

  it("é case-insensitive para a marcação", () => {
    const script = `[cena 1]

Texto minúsculo.

[CENA 2]

Texto maiúsculo.`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(2);
  });

  it("reordena cenas fora de ordem numérica", () => {
    const script = `[CENA 3]

Cena três.

[CENA 1]

Cena um.

[CENA 2]

Cena dois.`;

    const scenes = parseScenes(script);

    expect(scenes[0]?.sceneNumber).toBe(1);
    expect(scenes[1]?.sceneNumber).toBe(2);
    expect(scenes[2]?.sceneNumber).toBe(3);
  });

  it("suporta números de cena grandes", () => {
    const script = `[CENA 10]

Décima cena.

[CENA 20]

Vigésima cena.`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(2);
    expect(scenes[0]?.sceneNumber).toBe(10);
    expect(scenes[1]?.sceneNumber).toBe(20);
  });
});

describe("parseScenes — casos de cenas duplicadas", () => {
  it("mantém a última ocorrência de cena com número repetido", () => {
    const script = `[CENA 1]

Primeira versão.

[CENA 2]

Cena dois.

[CENA 1]

Segunda versão (sobrescreve).`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(2);
    expect(scenes[0]?.script).toContain("Segunda versão");
  });
});

describe("parseScenes — marcações inválidas", () => {
  it("ignora marcação sem número", () => {
    const script = `[CENA]

Sem número, inválida.

[CENA 1]

Válida.`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.sceneNumber).toBe(1);
  });

  it("ignora texto antes da primeira marcação válida", () => {
    const script = `Texto de introdução sem marcação.
Este texto não pertence a nenhuma cena.

[CENA 1]

Primeira cena válida.`;

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.script).toContain("Primeira cena válida");
  });

  it("não corrompe resultado com marcações inválidas intercaladas", () => {
    const script = `[CENA 1]

Cena um.

[CENA inválida]

Texto que não é cena.

[CENA 2]

Cena dois.`;

    const scenes = parseScenes(script);

    // CENA 1 e CENA 2 válidas; [CENA inválida] ignorada
    // O texto após [CENA inválida] pode ser incorporado à CENA 2 ou ignorado
    // O importante é que não corrompe e retorna ao menos 2 cenas válidas
    expect(scenes.length).toBeGreaterThanOrEqual(1);
    const sceneNumbers = scenes.map((s) => s.sceneNumber);
    expect(sceneNumbers).toContain(1);
    expect(sceneNumbers).toContain(2);
  });

  it("script sem nenhuma marcação retorna array vazio", () => {
    const script = "Este é um texto sem qualquer marcação de cena.";

    const scenes = parseScenes(script);

    expect(scenes).toHaveLength(0);
  });
});

describe("parseScenes — idempotência", () => {
  it("duas aplicações seguidas retornam o mesmo resultado", () => {
    const script = `[CENA 1]

Introdução.

[CENA 2]

Desenvolvimento.`;

    const firstPass = parseScenes(script);
    const reconstructed = composeScenesBackToScript(firstPass);
    const secondPass = parseScenes(reconstructed);

    expect(secondPass).toHaveLength(firstPass.length);
    expect(secondPass[0]?.sceneNumber).toBe(firstPass[0]?.sceneNumber);
    expect(secondPass[1]?.sceneNumber).toBe(firstPass[1]?.sceneNumber);
  });
});

describe("composeScenesBackToScript", () => {
  it("reconstrói script com marcações padronizadas", () => {
    const scenes = [
      { sceneNumber: 1, title: "Introdução", script: "Texto da introdução", orderIndex: 0 },
      { sceneNumber: 2, title: "Conclusão", script: "Texto da conclusão", orderIndex: 1 }
    ];

    const script = composeScenesBackToScript(scenes);

    expect(script).toContain("[CENA 1 - Introdução]");
    expect(script).toContain("[CENA 2 - Conclusão]");
    expect(script).toContain("Texto da introdução");
    expect(script).toContain("Texto da conclusão");
  });

  it("retorna string vazia para array vazio", () => {
    expect(composeScenesBackToScript([])).toBe("");
  });
});
