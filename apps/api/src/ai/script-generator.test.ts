import { describe, expect, it, vi } from "vitest";

import type { AiClient } from "./client.js";
import { generateScript, normalizeScript, type TelemetryEvent } from "./script-generator.js";

describe("normalizeScript", () => {
  it("remove trailing whitespace", () => {
    expect(normalizeScript("  hello  ")).toBe("hello");
  });

  it("normaliza \\r\\n para \\n", () => {
    expect(normalizeScript("line1\r\nline2")).toBe("line1\nline2");
  });

  it("colapsa múltiplas linhas em branco consecutivas", () => {
    expect(normalizeScript("A\n\n\n\nB")).toBe("A\n\nB");
  });

  it("preserva quebras simples", () => {
    expect(normalizeScript("[CENA 1]\n\nTexto da cena")).toBe("[CENA 1]\n\nTexto da cena");
  });
});

describe("generateScript", () => {
  it("chama o cliente de IA e retorna o script normalizado", async () => {
    const mockClient: AiClient = {
      generate: vi.fn().mockResolvedValue("[CENA 1]\n\nTexto de teste\n\n\n[CENA 2]\n\nFim")
    };

    const result = await generateScript(
      { theme: "tecnologia", tone: "educativo", targetDuration: 10 },
      mockClient
    );

    expect(mockClient.generate).toHaveBeenCalledOnce();
    expect(result.rawScript).toBe("[CENA 1]\n\nTexto de teste\n\n[CENA 2]\n\nFim");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it("emite eventos de telemetria script_start e script_end", async () => {
    const mockClient: AiClient = {
      generate: vi.fn().mockResolvedValue("[CENA 1]\n\nConteúdo")
    };

    const events: TelemetryEvent[] = [];
    const emit = (e: TelemetryEvent) => events.push(e);

    await generateScript({ theme: "saúde", tone: "informal", targetDuration: 5 }, mockClient, emit);

    expect(events).toHaveLength(2);
    expect(events[0]?.event).toBe("script_start");
    expect(events[1]?.event).toBe("script_end");
    expect(events[1]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("emite script_end com erro quando a IA falha", async () => {
    const mockClient: AiClient = {
      generate: vi.fn().mockRejectedValue(new Error("Provedor indisponível"))
    };

    const events: TelemetryEvent[] = [];
    const emit = (e: TelemetryEvent) => events.push(e);

    await expect(
      generateScript({ theme: "finanças", tone: "formal", targetDuration: 8 }, mockClient, emit)
    ).rejects.toThrow("Provedor indisponível");

    expect(events[1]?.error).toBe("Provedor indisponível");
  });

  it("não quebra com tema e tom vazios (edge case)", async () => {
    const mockClient: AiClient = {
      generate: vi.fn().mockResolvedValue("[CENA 1]\n\nOlá")
    };

    const result = await generateScript({ theme: "", tone: "", targetDuration: 1 }, mockClient);

    expect(result.rawScript).toBeTruthy();
  });
});
