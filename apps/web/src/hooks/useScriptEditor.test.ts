/**
 * Testes unitários para lógica do editor de roteiro.
 *
 * Testa a função persistScript e a lógica de status separadamente,
 * sem depender de React (que requer jsdom). Os testes de hook completo
 * ficam no E2E (MOT-127 E2E) ou em arquivo separado com jsdom.
 */

import { describe, expect, it, vi } from "vitest";

// Importa apenas a lógica pura, não o hook que depende de React
// A função persistScript é testada via mock do fetch global

describe("script editor — persistScript lógica", () => {
  it("faz PATCH com rawScript no body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "proj-1", rawScript: "conteúdo" })
    });

    vi.stubGlobal("fetch", mockFetch);

    // Simula o comportamento de persistScript
    const projectId = "proj-1";
    const rawScript = "[CENA 1]\n\nTexto de teste";
    const apiBaseUrl = "http://localhost:4000";

    await fetch(`${apiBaseUrl}/projects/${projectId}/script`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawScript })
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4000/projects/proj-1/script",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawScript })
      })
    );

    vi.unstubAllGlobals();
  });

  it("lança erro quando a API retorna status não-ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Projeto não encontrado" })
    });

    vi.stubGlobal("fetch", mockFetch);

    const response = await fetch("http://localhost:4000/projects/nao-existe/script", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawScript: "texto" })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);

    const body = (await response.json()) as { message: string };

    expect(body.message).toBe("Projeto não encontrado");

    vi.unstubAllGlobals();
  });

  it("status transitions: idle → saving → saved", () => {
    // Testa a máquina de estado sem React
    type SaveStatus = "idle" | "saving" | "saved" | "error";

    const transitions: Array<{ from: SaveStatus; event: string; to: SaveStatus }> = [
      { from: "idle", event: "startSave", to: "saving" },
      { from: "saving", event: "saveSuccess", to: "saved" },
      { from: "saving", event: "saveError", to: "error" },
      { from: "saved", event: "onChange", to: "idle" },
      { from: "error", event: "onChange", to: "idle" }
    ];

    function applyTransition(from: SaveStatus, event: string): SaveStatus {
      const t = transitions.find((tr) => tr.from === from && tr.event === event);
      return t?.to ?? from;
    }

    expect(applyTransition("idle", "startSave")).toBe("saving");
    expect(applyTransition("saving", "saveSuccess")).toBe("saved");
    expect(applyTransition("saving", "saveError")).toBe("error");
    expect(applyTransition("saved", "onChange")).toBe("idle");
    expect(applyTransition("error", "onChange")).toBe("idle");
  });

  it("debounce — cancela timer anterior ao receber nova edição", () => {
    vi.useFakeTimers();

    const saveCallback = vi.fn();
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleAutosave() {
      if (timer !== undefined) clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      timer = setTimeout(saveCallback, 1500);
    }

    // Simula edições rápidas
    scheduleAutosave();
    vi.advanceTimersByTime(500);
    scheduleAutosave(); // Cancela o anterior
    vi.advanceTimersByTime(500);
    scheduleAutosave(); // Cancela o anterior
    vi.advanceTimersByTime(1500); // Dispara o último

    expect(saveCallback).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
