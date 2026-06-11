"use client";

import { useCallback, useEffect, useState } from "react";

import {
  applyPreviewTransition,
  applyVoiceSelectionTransition,
  type PreviewStatus,
  type VoiceSelectionStatus,
} from "./voice-library-state";

interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
  sampleDurationSeconds: number;
  status: string;
}

interface Scene {
  audioPath?: string | null;
  hasValidAudio?: boolean;
  id: string;
  script: string;
  status?: string;
  title: string;
}

interface VoiceProfileManagerProps {
  apiBaseUrl: string;
  initialVoiceProfileId: string | null;
  projectId: string;
}

async function parseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  return body.message ?? `HTTP ${response.status}`;
}

export function VoiceProfileManager({
  apiBaseUrl,
  initialVoiceProfileId,
  projectId,
}: VoiceProfileManagerProps) {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [name, setName] = useState("");
  const [sample, setSample] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSceneId, setPreviewSceneId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<
    string | null
  >(initialVoiceProfileId);
  const [selectionStatus, setSelectionStatus] =
    useState<VoiceSelectionStatus>("idle");
  const [sceneAudioMessage, setSceneAudioMessage] = useState<string | null>(
    null,
  );
  const [sceneAudioPending, setSceneAudioPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [renderStatusPolling, setRenderStatusPolling] = useState(false);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      const [profilesResponse, scenesResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/voice-profiles`, { cache: "no-store", signal }),
        fetch(`${apiBaseUrl}/projects/${projectId}/scenes`, {
          cache: "no-store",
          signal,
        }),
      ]);

      if (!profilesResponse.ok) {
        throw new Error(await parseError(profilesResponse));
      }

      if (!scenesResponse.ok) {
        throw new Error(await parseError(scenesResponse));
      }

      const profilesBody = (await profilesResponse.json()) as VoiceProfile[];
      const scenesBody = (await scenesResponse.json()) as { scenes: Scene[] };
      setProfiles(profilesBody);
      setScenes(scenesBody.scenes);
    },
    [apiBaseUrl, projectId],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function hydrate() {
      try {
        await loadData(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Erro ao carregar vozes",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      controller.abort();
    };
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (previewSource) {
        URL.revokeObjectURL(previewSource);
      }
    };
  }, [previewSource]);

  async function persistVoiceSelection() {
    setSelectionStatus((current) =>
      applyVoiceSelectionTransition(current, "saveStart"),
    );
    setErrorMessage(null);
    setRenderMessage(null);
    setSceneAudioMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/voice-profile`,
        {
          body: JSON.stringify({ voiceProfileId: selectedVoiceProfileId }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      setSelectionStatus(() =>
        applyVoiceSelectionTransition("saving", "saveSuccess"),
      );
      setSuccessMessage("Voz ativa salva no projeto");
      await loadData();
    } catch (error) {
      setSelectionStatus(() =>
        applyVoiceSelectionTransition("saving", "saveError"),
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro ao salvar voz do projeto",
      );
    }
  }

  async function handlePreview(scene: Scene) {
    setPreviewStatus(applyPreviewTransition("start"));
    setPreviewError(null);
    setPreviewSceneId(scene.id);

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes/${scene.id}/preview`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const audio = await response.blob();
      const url = URL.createObjectURL(audio);

      setPreviewSource((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return url;
      });
      setPreviewStatus(applyPreviewTransition("done"));
    } catch (error) {
      setPreviewStatus(applyPreviewTransition("error"));
      setPreviewError(
        error instanceof Error ? error.message : "Erro ao gerar preview",
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setRenderMessage(null);
    setSceneAudioMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name);

      if (sample) {
        formData.append("sample", sample);
      }

      const response = await fetch(`${apiBaseUrl}/voice-profiles`, {
        body: formData,
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const created = (await response.json()) as VoiceProfile;
      setProfiles((current) => [created, ...current]);
      setSelectedVoiceProfileId(created.id);
      setSelectionStatus((current) =>
        applyVoiceSelectionTransition(current, "change"),
      );
      setName("");
      setSample(null);
      setSuccessMessage("Perfil de voz criado com sucesso");

      const fileInput = document.getElementById(
        "voice-sample-input",
      ) as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao criar perfil de voz",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateSceneAudio() {
    setErrorMessage(null);
    setRenderMessage(null);
    setSceneAudioMessage(null);
    setSceneAudioPending(true);

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes/audio/generate`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const body = (await response.json()) as {
        generatedCount: number;
        scenes: Scene[];
        skippedCount: number;
      };

      setScenes(body.scenes);
      setSceneAudioMessage(
        body.generatedCount === 0
          ? "Todos os áudios já estavam válidos"
          : `${body.generatedCount} cena(s) gerada(s), ${body.skippedCount} reaproveitada(s)`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao gerar áudio por cena",
      );
    } finally {
      setSceneAudioPending(false);
    }
  }

  const pollRenderStatus = useCallback(
    (_jobId: string) => {
      setRenderStatusPolling(true);
      let attempts = 0;
      const maxAttempts = 100;
      const interval = 2000;

      const runPoll = async () => {
        try {
          const response = await fetch(
            `${apiBaseUrl}/projects/${projectId}/renders`,
            {
              cache: "no-store",
            },
          );

          if (!response.ok) {
            throw new Error("Erro ao buscar status do render");
          }

          const job = (await response.json()) as {
            status: string;
            errorMessage?: string | null;
          };
          if (job.status === "queued") {
            setRenderMessage("Render enfileirado...");
          } else if (job.status === "running") {
            setRenderMessage("Renderizando...");
          } else if (job.status === "succeeded") {
            setRenderMessage("Renderizado com sucesso!");
            setRenderStatusPolling(false);
            return;
          } else if (job.status === "failed") {
            setRenderMessage(
              `Erro no render: ${job.errorMessage ?? "Erro desconhecido"}`,
            );
            setRenderStatusPolling(false);
            return;
          }

          attempts += 1;
          if (attempts < maxAttempts) {
            setTimeout(() => {
              void runPoll();
            }, interval);
          } else {
            setRenderMessage(
              "Tempo limite atingido ao verificar status do render",
            );
            setRenderStatusPolling(false);
          }
        } catch (error) {
          setRenderMessage(
            error instanceof Error
              ? error.message
              : "Erro ao acompanhar render",
          );
          setRenderStatusPolling(false);
        }
      };

      setTimeout(() => {
        void runPoll();
      }, interval);
    },
    [apiBaseUrl, projectId],
  );

  async function handleRenderValidation() {
    setErrorMessage(null);
    setRenderMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/renders`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const job = (await response.json()) as { id: string; status: string };
      setRenderMessage("Render enfileirado com sucesso");
      window.dispatchEvent(
        new CustomEvent("open-video-studio:render-queued", {
          detail: { projectId },
        }),
      );
      pollRenderStatus(job.id);
    } catch (error) {
      setRenderMessage(
        error instanceof Error ? error.message : "Erro ao validar render",
      );
    }
  }

  return (
    <section
      aria-label="Biblioteca de vozes"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: 24,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ color: "#f8fafc", margin: "0 0 4px", fontSize: 20 }}>
            Biblioteca de vozes
          </h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
            Selecione a voz ativa do projeto e ouça um preview por cena antes do
            render final.
          </p>
        </div>
        <span
          style={{
            color: "#cbd5e1",
            fontSize: 13,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.4)",
          }}
        >
          {profiles.length} perfil(is)
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: 12, marginTop: 20 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#e2e8f0", fontSize: 13 }}>Nome do perfil</span>
          <input
            id="voice-profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Narrador principal"
            style={{
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "rgba(15,23,42,0.5)",
              color: "#f8fafc",
              padding: "12px 14px",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#e2e8f0", fontSize: 13 }}>
            Amostra de voz (.wav)
          </span>
          <input
            id="voice-sample-input"
            type="file"
            accept=".wav,audio/wav"
            onChange={(event) => setSample(event.target.files?.[0] ?? null)}
            style={{ color: "#cbd5e1" }}
          />
        </label>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            id="voice-profile-submit"
            type="submit"
            disabled={isSubmitting}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "12px 18px",
              background: isSubmitting ? "#334155" : "#f97316",
              color: "#fff7ed",
              cursor: isSubmitting ? "wait" : "pointer",
              fontWeight: 600,
            }}
          >
            {isSubmitting ? "Enviando..." : "Criar perfil"}
          </button>

          {successMessage ? (
            <span style={{ color: "#86efac", fontSize: 13 }}>
              {successMessage}
            </span>
          ) : null}
          {errorMessage ? (
            <span
              id="voice-profile-error"
              style={{ color: "#fda4af", fontSize: 13 }}
            >
              {errorMessage}
            </span>
          ) : null}
        </div>
      </form>

      <div style={{ marginTop: 24 }}>
        {isLoading ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            Carregando perfis de voz...
          </p>
        ) : profiles.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            Nenhum perfil de voz cadastrado ainda.
          </p>
        ) : (
          <ul
            id="voice-profile-list"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {profiles.map((profile) => (
              <li
                key={profile.id}
                style={{
                  borderRadius: 12,
                  padding: 14,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(15,23,42,0.32)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <input
                      type="radio"
                      name="selected-voice-profile"
                      checked={selectedVoiceProfileId === profile.id}
                      onChange={() => {
                        setSelectedVoiceProfileId(profile.id);
                        setSelectionStatus((current) =>
                          applyVoiceSelectionTransition(current, "change"),
                        );
                      }}
                    />
                    <div>
                      <strong style={{ color: "#f8fafc", display: "block" }}>
                        {profile.name}
                      </strong>
                      <span style={{ color: "#94a3b8", fontSize: 13 }}>
                        {profile.provider} •{" "}
                        {profile.sampleDurationSeconds.toFixed(2)}s
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      color: "#cbd5e1",
                      fontSize: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {profile.status}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          id="save-project-voice"
          type="button"
          onClick={() => void persistVoiceSelection()}
          disabled={!selectedVoiceProfileId || selectionStatus === "saving"}
          style={{
            border: 0,
            borderRadius: 10,
            padding: "10px 16px",
            background: selectionStatus === "saving" ? "#334155" : "#0ea5e9",
            color: "#e0f2fe",
            cursor:
              !selectedVoiceProfileId || selectionStatus === "saving"
                ? "not-allowed"
                : "pointer",
            fontWeight: 600,
          }}
        >
          {selectionStatus === "saving"
            ? "Salvando voz..."
            : "Salvar voz do projeto"}
        </button>

        <span
          id="voice-selection-status"
          style={{ color: "#cbd5e1", fontSize: 13 }}
        >
          {selectionStatus === "saved"
            ? "Voz salva"
            : selectionStatus === "error"
              ? "Erro ao salvar voz"
              : "Selecione uma voz para o projeto"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          id="generate-scene-audio"
          type="button"
          onClick={() => void handleGenerateSceneAudio()}
          disabled={
            !selectedVoiceProfileId || sceneAudioPending || scenes.length === 0
          }
          style={{
            border: 0,
            borderRadius: 10,
            padding: "10px 16px",
            background: sceneAudioPending ? "#334155" : "#14b8a6",
            color: "#ecfeff",
            cursor:
              !selectedVoiceProfileId ||
              sceneAudioPending ||
              scenes.length === 0
                ? "not-allowed"
                : "pointer",
            fontWeight: 600,
          }}
        >
          {sceneAudioPending ? "Gerando áudio..." : "Gerar áudio das cenas"}
        </button>

        <button
          id="queue-render"
          type="button"
          onClick={() => void handleRenderValidation()}
          disabled={scenes.length === 0 || renderStatusPolling}
          style={{
            border: 0,
            borderRadius: 10,
            padding: "10px 16px",
            background: renderStatusPolling ? "#4c1d95" : "#8b5cf6",
            color: "#f5f3ff",
            cursor:
              scenes.length === 0 || renderStatusPolling
                ? "not-allowed"
                : "pointer",
            fontWeight: 600,
          }}
        >
          {renderStatusPolling ? "Processando render..." : "Validar render"}
        </button>

        {sceneAudioMessage ? (
          <span
            id="scene-audio-status"
            style={{ color: "#99f6e4", fontSize: 13 }}
          >
            {sceneAudioMessage}
          </span>
        ) : null}
        {renderMessage ? (
          <span id="render-status" style={{ color: "#ddd6fe", fontSize: 13 }}>
            {renderMessage}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
        <h3 style={{ color: "#f8fafc", margin: 0, fontSize: 18 }}>
          Preview por cena
        </h3>
        {scenes.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>
            Nenhuma cena persistida ainda. Recompose as cenas para habilitar o
            preview.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {scenes.map((scene) => (
              <li
                key={scene.id}
                style={{
                  borderRadius: 12,
                  padding: 14,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(15,23,42,0.32)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <strong style={{ color: "#f8fafc", display: "block" }}>
                      {scene.title}
                    </strong>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: 13,
                        margin: "6px 0 0",
                      }}
                    >
                      {scene.script}
                    </p>
                    <span
                      style={{
                        color: scene.hasValidAudio ? "#86efac" : "#fbbf24",
                        display: "inline-block",
                        fontSize: 12,
                        marginTop: 8,
                      }}
                    >
                      {scene.hasValidAudio ? "Audio valido" : "Audio pendente"}
                    </span>
                  </div>
                  <button
                    id={`preview-scene-${scene.id}`}
                    type="button"
                    onClick={() => void handlePreview(scene)}
                    disabled={
                      !selectedVoiceProfileId || previewStatus === "loading"
                    }
                    style={{
                      border: 0,
                      borderRadius: 10,
                      padding: "10px 14px",
                      background:
                        previewStatus === "loading" &&
                        previewSceneId === scene.id
                          ? "#334155"
                          : "#22c55e",
                      color: "#052e16",
                      cursor:
                        !selectedVoiceProfileId || previewStatus === "loading"
                          ? "not-allowed"
                          : "pointer",
                      fontWeight: 600,
                      minWidth: 120,
                    }}
                  >
                    {previewStatus === "loading" && previewSceneId === scene.id
                      ? "Gerando..."
                      : "Ouvir preview"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewError ? (
        <p
          id="preview-error"
          style={{ color: "#fda4af", margin: "12px 0 0", fontSize: 13 }}
        >
          {previewError}
        </p>
      ) : null}

      {previewSource ? (
        <audio
          id="scene-preview-audio"
          controls
          autoPlay
          src={previewSource}
          style={{ width: "100%", marginTop: 12 }}
        />
      ) : null}
    </section>
  );
}
