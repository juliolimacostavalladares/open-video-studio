"use client";

import { useCallback, useEffect, useState } from "react";

interface Asset {
  id: string;
  kind: "image" | "video";
  path: string;
  source: string;
  status: string;
}

interface Scene {
  id: string;
  title: string;
  script: string;
  keywords: string[];
  assetId?: string | null;
  asset?: Asset | null;
}

interface SceneAssetManagerProps {
  apiBaseUrl: string;
  projectId: string;
}

export function SceneAssetManager({
  apiBaseUrl,
  projectId,
}: SceneAssetManagerProps) {
  const [mounted, setMounted] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);

  const loadScenes = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/projects/${projectId}/scenes`,
          {
            cache: "no-store",
            signal,
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const body = (await response.json()) as { scenes: Scene[] };
        setScenes(body.scenes);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setErrorMessage(error.message);
        }
      }
    },
    [apiBaseUrl, projectId],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const controller = new AbortController();

    async function hydrate() {
      setIsLoading(true);
      await loadScenes(controller.signal);
      setIsLoading(false);
    }

    void hydrate();

    return () => {
      controller.abort();
    };
  }, [loadScenes, mounted]);

  async function handleFileUpload(sceneId: string, file: File) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadingSceneId(sceneId);

    try {
      const formData = new FormData();
      formData.append("asset", file);

      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}/asset`,
        {
          body: formData,
          method: "POST",
        },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message ?? `HTTP ${response.status}`);
      }

      setSuccessMessage("Asset enviado e associado com sucesso!");
      await loadScenes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao enviar arquivo",
      );
    } finally {
      setUploadingSceneId(null);
    }
  }

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <section
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: 24,
          backdropFilter: "blur(12px)",
          color: "#cbd5e1",
        }}
      >
        <p>Carregando assets...</p>
      </section>
    );
  }

  return (
    <section
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)",
        color: "#cbd5e1",
      }}
    >
      <h2 style={{ color: "#f8fafc", margin: "0 0 16px", fontSize: 20 }}>
        Gerenciador de Assets por Cena
      </h2>

      {errorMessage && (
        <p
          id="asset-error"
          style={{ color: "#fda4af", fontSize: 14, margin: "0 0 16px" }}
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          id="asset-success"
          style={{ color: "#6ee7b7", fontSize: 14, margin: "0 0 16px" }}
        >
          {successMessage}
        </p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {scenes.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            Nenhuma cena encontrada.
          </p>
        ) : (
          scenes.map((scene) => (
            <div
              key={scene.id}
              style={{
                borderRadius: 12,
                padding: 16,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15,23,42,0.32)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <strong style={{ color: "#f8fafc", fontSize: 16 }}>
                  {scene.title}
                </strong>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0" }}>
                  {scene.script}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {(scene.keywords || []).map((kw, i) => (
                    <span
                      key={i}
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.25)",
                        color: "#c7d2fe",
                        padding: "2px 8px",
                        borderRadius: 20,
                        fontSize: 11,
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(148,163,184,0.1)",
                  paddingTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <span
                    style={{ fontSize: 12, color: "#64748b", display: "block" }}
                  >
                    Asset Atual
                  </span>
                  {scene.asset &&
                  scene.asset.path !==
                    "assets/fallbacks/default-placeholder.png" ? (
                    <span
                      id={`scene-asset-status-${scene.id}`}
                      style={{
                        color: "#34d399",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {scene.asset.kind === "video"
                        ? "🎥 Vídeo Manual"
                        : "🖼️ Imagem Manual"}{" "}
                      ({scene.asset.path.split("/").pop()})
                    </span>
                  ) : (
                    <span
                      id={`scene-asset-status-${scene.id}`}
                      style={{
                        color: "#fbbf24",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      ⚠️ Fallback Visual Ativo
                    </span>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      background:
                        uploadingSceneId === scene.id ? "#334155" : "#6366f1",
                      color: "#e0e7ff",
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor:
                        uploadingSceneId === scene.id
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {uploadingSceneId === scene.id
                      ? "Enviando..."
                      : "Substituir Asset (Upload)"}
                    <input
                      id={`upload-asset-input-${scene.id}`}
                      type="file"
                      accept=".mp4,.mov,.jpg,.jpeg,.png"
                      disabled={uploadingSceneId === scene.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleFileUpload(scene.id, file);
                        }
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
