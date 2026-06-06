"use client";

import { useScriptEditor, type SaveStatus } from "../hooks/useScriptEditor";

interface ScriptEditorProps {
  projectId: string;
  initialScript: string;
  projectTitle: string;
}

function SaveIndicator({ status, lastSavedAt, errorMessage }: {
  status: SaveStatus;
  lastSavedAt: Date | null;
  errorMessage: string | null;
}) {
  if (status === "saving") {
    return (
      <span
        id="save-status"
        style={{ color: "#888", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        aria-live="polite"
        aria-label="Salvando roteiro..."
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#f59e0b",
            display: "inline-block",
            animation: "pulse 1s infinite"
          }}
        />
        Salvando...
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span
        id="save-status"
        style={{ color: "#22c55e", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        aria-live="polite"
        aria-label="Roteiro salvo"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#22c55e",
            display: "inline-block"
          }}
        />
        Salvo às {lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        id="save-status"
        style={{ color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        aria-live="assertive"
        aria-label={`Erro ao salvar: ${errorMessage ?? "erro desconhecido"}`}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#ef4444",
            display: "inline-block"
          }}
        />
        Erro ao salvar
      </span>
    );
  }

  return (
    <span
      id="save-status"
      style={{ color: "#888", fontSize: 13 }}
      aria-live="polite"
    >
      Não salvo
    </span>
  );
}

export function ScriptEditor({ projectId, initialScript, projectTitle }: ScriptEditorProps) {
  const { script, saveStatus, lastSavedAt, errorMessage, onChange, save } = useScriptEditor({
    projectId,
    initialScript
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "100%"
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
            color: "#f1f5f9"
          }}
        >
          {projectTitle}
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SaveIndicator
            status={saveStatus}
            lastSavedAt={lastSavedAt}
            errorMessage={errorMessage}
          />

          <button
            id="save-button"
            onClick={() => void save()}
            disabled={saveStatus === "saving"}
            aria-label="Salvar roteiro agora"
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: saveStatus === "saving" ? "#334155" : "#6366f1",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
              transition: "background 0.2s"
            }}
          >
            {saveStatus === "saving" ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Editor textarea */}
      <textarea
        id="script-editor"
        value={script}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`[CENA 1]\n\nDescreva o conteúdo da primeira cena aqui...\n\n[CENA 2]\n\nConteúdo da segunda cena...`}
        aria-label="Editor de roteiro"
        aria-describedby="save-status"
        style={{
          flex: 1,
          width: "100%",
          minHeight: 480,
          padding: 20,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(15,23,42,0.8)",
          color: "#e2e8f0",
          fontSize: 15,
          lineHeight: 1.7,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box"
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "rgba(99,102,241,0.5)";
          e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "rgba(255,255,255,0.1)";
          e.target.style.boxShadow = "none";
        }}
      />

      {errorMessage && (
        <p
          role="alert"
          style={{ color: "#f87171", fontSize: 13, margin: 0, padding: "0 4px" }}
        >
          ⚠ {errorMessage}
        </p>
      )}
    </div>
  );
}
