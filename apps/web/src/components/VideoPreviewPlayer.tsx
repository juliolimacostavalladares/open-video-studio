"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  applyVideoRenderTransition,
  type VideoRenderStatus,
} from "./video-render-state";

interface VideoPreviewPlayerProps {
  projectId: string;
  apiBaseUrl: string;
}

interface RenderJob {
  id: string;
  projectId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  outputPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export function VideoPreviewPlayer({
  projectId,
  apiBaseUrl,
}: VideoPreviewPlayerProps) {
  const [mounted, setMounted] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [renderStatus, setRenderStatus] = useState<VideoRenderStatus>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jobRef = useRef<RenderJob | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/renders`,
        {
          cache: "no-store",
        },
      );

      if (response.status === 404) {
        setJob(null);
        setRenderStatus((current) =>
          applyVideoRenderTransition(current, "reset"),
        );
        return;
      }

      if (!response.ok) {
        throw new Error("Falha ao buscar status do render");
      }

      const data = (await response.json()) as RenderJob;
      setJob(data);

      if (data.status === "queued") {
        setRenderStatus((current) =>
          applyVideoRenderTransition(current, "queued"),
        );
      } else if (data.status === "running") {
        setRenderStatus((current) =>
          applyVideoRenderTransition(current, "running"),
        );
      } else if (data.status === "succeeded") {
        setRenderStatus((current) =>
          applyVideoRenderTransition(current, "succeeded"),
        );
      } else if (data.status === "failed") {
        setRenderStatus((current) =>
          applyVideoRenderTransition(current, "failed"),
        );
      }

      setError(null);
    } catch (err) {
      if (!jobRef.current) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar render",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, projectId]);

  useEffect(() => {
    if (!mounted) return;
    void fetchStatus();
  }, [fetchStatus, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const handleRenderQueued = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId !== projectId) return;
      void fetchStatus();
    };

    window.addEventListener(
      "open-video-studio:render-queued",
      handleRenderQueued,
    );

    return () => {
      window.removeEventListener(
        "open-video-studio:render-queued",
        handleRenderQueued,
      );
    };
  }, [fetchStatus, mounted, projectId]);

  useEffect(() => {
    if (!mounted) return;
    if (!job) return;

    const isDone =
      job && (job.status === "succeeded" || job.status === "failed");
    if (isDone) return;

    const timer = setInterval(() => {
      void fetchStatus();
    }, 2000);

    return () => clearInterval(timer);
  }, [job, fetchStatus, mounted]);

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: 24,
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: 16,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        Carregando status do render...
      </div>
    );
  }

  const getVideoUrl = () => {
    if (!job?.outputPath) return "";
    const relativeKey = job.outputPath.replace(/^renders\//, "");
    return `${apiBaseUrl}/renders/${relativeKey}`;
  };

  return (
    <section
      aria-label="Visualizador do vídeo"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ color: "#f8fafc", margin: 0, fontSize: 18 }}>
          Vídeo Renderizado
        </h3>
        {job ? (
          <span
            id="video-render-status-badge"
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 20,
              fontWeight: 600,
              textTransform: "uppercase",
              background:
                renderStatus === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : renderStatus === "error"
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(139, 92, 246, 0.15)",
              color:
                renderStatus === "success"
                  ? "#10b981"
                  : renderStatus === "error"
                    ? "#ef4444"
                    : "#a78bfa",
              border: `1px solid ${
                renderStatus === "success"
                  ? "rgba(16, 185, 129, 0.3)"
                  : renderStatus === "error"
                    ? "rgba(239, 68, 68, 0.3)"
                    : "rgba(139, 92, 246, 0.3)"
              }`,
            }}
          >
            {renderStatus === "success"
              ? "Pronto"
              : renderStatus === "error"
                ? "Erro"
                : renderStatus === "rendering"
                  ? "Processando"
                  : "Na Fila"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div id="player-error" style={{ color: "#fda4af", fontSize: 14 }}>
          {error}
        </div>
      ) : null}

      {!job ? (
        <div
          id="no-render-state"
          style={{
            padding: "40px 20px",
            border: "2px dashed rgba(255, 255, 255, 0.08)",
            borderRadius: 12,
            textAlign: "center",
            color: "#64748b",
          }}
        >
          Nenhum render realizado para este projeto. Preencha o roteiro, gere o
          áudio das cenas e clique em &quot;Validar render&quot; para iniciar.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {renderStatus === "queued" && (
            <div
              id="rendering-queued-state"
              style={{
                padding: "30px 20px",
                background: "rgba(139, 92, 246, 0.05)",
                border: "1px dashed rgba(139, 92, 246, 0.2)",
                borderRadius: 12,
                textAlign: "center",
                color: "#c084fc",
                animation: "pulse 2s infinite ease-in-out",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Aguardando na fila...
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                O job de renderização iniciará em instantes.
              </div>
            </div>
          )}

          {renderStatus === "rendering" && (
            <div
              id="rendering-running-state"
              style={{
                padding: "30px 20px",
                background: "rgba(139, 92, 246, 0.08)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                borderRadius: 12,
                textAlign: "center",
                color: "#a78bfa",
                animation: "pulse 1.5s infinite ease-in-out",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Renderizando vídeo...
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Misturando cenas, áudio e assets de imagem.
              </div>
            </div>
          )}

          {renderStatus === "error" && (
            <div
              id="rendering-failed-state"
              style={{
                padding: 20,
                background: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: 12,
                color: "#fca5a5",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Falha na renderização:
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontFamily: "monospace",
                  background: "rgba(0,0,0,0.2)",
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                {job.errorMessage || "Erro desconhecido."}
              </div>
            </div>
          )}

          {renderStatus === "success" && (
            <div
              id="ready-for-review-state"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 360,
                  aspectRatio: "9/16",
                  background: "#000",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <video
                  id="rendered-video-player"
                  src={getVideoUrl()}
                  controls
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div
                style={{
                  textAlign: "center",
                  color: "#10b981",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Vídeo pronto para revisão!
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
