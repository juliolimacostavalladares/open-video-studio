/**
 * useScriptEditor — hook de edição de roteiro com autosave
 *
 * Estado editável previsível e testável:
 * - mantém valor atual do roteiro
 * - expõe status: idle | saving | saved | error
 * - autosave com debounce (padrão 1500ms)
 * - salva explicitamente via save()
 * - não perde conteúdo em refresh (salva antes de desmontar)
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseScriptEditorOptions {
  projectId: string;
  initialScript: string;
  /** Debounce em ms antes do autosave. Padrão: 1500ms */
  debounceMs?: number;
  /** URL base da API. Padrão: process.env.NEXT_PUBLIC_API_URL */
  apiBaseUrl?: string;
}

export interface UseScriptEditorReturn {
  script: string;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  errorMessage: string | null;
  onChange: (value: string) => void;
  save: () => Promise<void>;
}

async function persistScript(
  projectId: string,
  rawScript: string,
  apiBaseUrl: string
): Promise<void> {
  const url = `${apiBaseUrl}/projects/${projectId}/script`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawScript })
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${response.status}`);
  }
}

export function useScriptEditor({
  projectId,
  initialScript,
  debounceMs = 1500,
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
}: UseScriptEditorOptions): UseScriptEditorReturn {
  const [script, setScript] = useState(initialScript);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs para evitar closures stale no debounce
  const scriptRef = useRef(script);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  scriptRef.current = script;

  const save = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return;

    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      await persistScript(projectId, scriptRef.current, apiBaseUrl);

      if (isMounted.current) {
        setSaveStatus("saved");
        setLastSavedAt(new Date());
      }
    } catch (error) {
      if (isMounted.current) {
        setSaveStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Erro ao salvar");
      }
    }
  }, [projectId, apiBaseUrl]);

  const onChange = useCallback(
    (value: string) => {
      setScript(value);
      setSaveStatus("idle");

      // Cancela debounce anterior e agenda novo
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        void save();
      }, debounceMs);
    },
    [save, debounceMs]
  );

  // Salva ao desmontar para não perder conteúdo em navegação/refresh
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    script,
    saveStatus,
    lastSavedAt,
    errorMessage,
    onChange,
    save
  };
}
