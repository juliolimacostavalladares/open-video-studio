"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { validateMetadata } from "../utils/metadata-validation";

interface ProjectReviewProps {
  projectId: string;
  apiBaseUrl: string;
}

interface ProjectData {
  id: string;
  title: string;
  description: string | null;
  rawScript: string | null;
  status: string;
  voiceProfileId: string | null;
  estimatedDuration: number;
  tags?: string[];
  youtubeVideoId?: string | null;
  youtubePublishStatus?: string;
  youtubePublishError?: string | null;
  publishedAt?: string | null;
  scheduledPublishAt?: string | null;
  scheduledPublishAtLocal?: string | null;
  scheduledPublishTimezone?: string | null;
}

interface RenderJob {
  id: string;
  projectId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  outputPath: string | null;
  errorMessage: string | null;
}

interface VoiceProfile {
  id: string;
  name: string;
}

interface Scene {
  id: string;
  title: string;
  orderIndex: number;
  script: string;
}

export function ProjectReview({ projectId, apiBaseUrl }: ProjectReviewProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    tags?: string;
  }>({});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    setSaveSuccess(null);

    const validation = validateMetadata({
      title: editTitle,
      description: editDescription,
      tagsString: editTags,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: validation.parsed.title,
          description: validation.parsed.description,
          tags: validation.parsed.tags,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Falha ao salvar metadados");
      }

      const updatedProject = (await res.json()) as ProjectData;
      setProject(updatedProject);
      setEditTitle(updatedProject.title || "");
      setEditDescription(updatedProject.description || "");
      setEditTags(updatedProject.tags ? updatedProject.tags.join(", ") : "");

      setSaveSuccess("Metadados salvos com sucesso!");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setValidationErrors({
        title: err instanceof Error ? err.message : "Erro ao salvar metadados",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isScheduledMode, setIsScheduledMode] = useState(false);
  const [scheduledDateLocal, setScheduledDateLocal] = useState("");
  const [scheduledTimezone, setScheduledTimezone] =
    useState("America/Sao_Paulo");

  interface YoutubeChannel {
    id: string;
    channelId: string;
    title: string;
    thumbnail: string | null;
  }

  const [youtubeChannel, setYoutubeChannel] = useState<YoutubeChannel | null>(
    null,
  );
  const [isLoadingChannel, setIsLoadingChannel] = useState(true);
  const [channelError, setChannelError] = useState<string | null>(null);

  const fetchYoutubeChannel = async () => {
    setIsLoadingChannel(true);
    setChannelError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/projects/${projectId}/youtube-channel`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        throw new Error("Erro ao buscar canal do YouTube");
      }
      const data = await res.json();
      setYoutubeChannel(data);
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingChannel(false);
    }
  };

  const handleConnectYoutube = async () => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/youtube/auth-url?projectId=${projectId}`,
      );
      if (!res.ok) {
        throw new Error("Falha ao gerar URL de autenticação");
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setChannelError(
        err instanceof Error ? err.message : "Erro ao conectar canal",
      );
    }
  };

  const handlePublish = async () => {
    if (!youtubeChannel) {
      setPublishError("Nenhum canal do YouTube conectado.");
      return;
    }
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      const payload: {
        scheduledPublishAtLocal?: string;
        scheduledPublishTimezone?: string;
      } = {};
      if (isScheduledMode) {
        if (!scheduledDateLocal) {
          throw new Error(
            "Por favor, selecione uma data e hora para o agendamento.",
          );
        }
        // Format from "YYYY-MM-DDTHH:MM" to "YYYY-MM-DD HH:MM"
        payload.scheduledPublishAtLocal = scheduledDateLocal.replace("T", " ");
        payload.scheduledPublishTimezone = scheduledTimezone;
      }

      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Falha ao publicar o projeto");
      }
      await loadData();
      setPublishSuccess(
        data.message ||
          (isScheduledMode
            ? "Vídeo agendado com sucesso!"
            : "Vídeo publicado com sucesso!"),
      );
    } catch (err) {
      await loadData();
      setPublishError(
        err instanceof Error ? err.message : "Erro ao publicar projeto",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleResetPublishStatus = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/projects/${projectId}/youtube/reset`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        throw new Error("Falha ao redefinir status de publicação");
      }
      await loadData();
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Erro ao redefinir status",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Falha ao aprovar o projeto");
      }
      const updatedProject = (await res.json()) as ProjectData;
      setProject(updatedProject);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao aprovar projeto",
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async () => {
    setIsProcessingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/reject`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Falha ao rejeitar o projeto");
      }
      const updatedProject = (await res.json()) as ProjectData;
      setProject(updatedProject);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao rejeitar projeto",
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const getStatusLabelAndStyle = () => {
    if (!project) {
      return {
        text: "Carregando...",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.15)",
        border: "1px solid rgba(148, 163, 184, 0.3)",
      };
    }
    switch (project.status) {
      case "approved":
        return {
          text: "Aprovado",
          color: "#10b981",
          bg: "rgba(16, 185, 129, 0.15)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
        };
      case "rejected":
        return {
          text: "Rejeitado",
          color: "#f43f5e",
          bg: "rgba(244, 63, 94, 0.15)",
          border: "1px solid rgba(244, 63, 94, 0.3)",
        };
      case "ready_for_review":
      default:
        return {
          text: "Pronto para Revisão",
          color: "#a78bfa",
          bg: "rgba(139, 92, 246, 0.15)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
        };
    }
  };
  const loadData = useCallback(async () => {
    try {
      // Fetch project details
      const projectRes = await fetch(`${apiBaseUrl}/projects/${projectId}`, {
        cache: "no-store",
      });
      if (!projectRes.ok) {
        if (projectRes.status === 404) {
          throw new Error("Projeto não encontrado");
        }
        throw new Error("Falha ao carregar os dados do projeto");
      }
      const projectData = (await projectRes.json()) as ProjectData;

      setProject(projectData);
      setEditTitle(projectData.title || "");
      setEditDescription(projectData.description || "");
      setEditTags(projectData.tags ? projectData.tags.join(", ") : "");

      // Fetch render job status
      const renderRes = await fetch(
        `${apiBaseUrl}/projects/${projectId}/renders`,
        {
          cache: "no-store",
        },
      );
      if (renderRes.ok) {
        const renderData = (await renderRes.json()) as RenderJob;
        setRenderJob(renderData);
      } else if (renderRes.status !== 404) {
        console.error("Falha ao buscar status do render");
      }

      // Fetch scenes
      const scenesRes = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes`,
        {
          cache: "no-store",
        },
      );
      if (scenesRes.ok) {
        const scenesData = await scenesRes.json();
        const scenesList = Array.isArray(scenesData)
          ? scenesData
          : scenesData.scenes || [];
        setScenes(
          scenesList.sort((a: Scene, b: Scene) => a.orderIndex - b.orderIndex),
        );
      }

      // Fetch voice profiles
      const voicesRes = await fetch(`${apiBaseUrl}/voice-profiles`, {
        cache: "no-store",
      });
      if (voicesRes.ok) {
        const voicesData = (await voicesRes.json()) as VoiceProfile[];
        setVoiceProfiles(voicesData);
      }

      // Fetch youtube channel
      try {
        const channelRes = await fetch(
          `${apiBaseUrl}/projects/${projectId}/youtube-channel`,
          { cache: "no-store" },
        );
        if (channelRes.ok) {
          const channelData = await channelRes.json();
          setYoutubeChannel(channelData);
        }
      } catch (err) {
        console.error("Falha ao buscar canal do YouTube", err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
      setIsLoadingChannel(false);
    }
  }, [projectId, apiBaseUrl]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("oauth");
    const oauthMessage = params.get("message");
    if (oauthStatus === "success") {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      void fetchYoutubeChannel();
    } else if (oauthStatus === "error") {
      setChannelError(oauthMessage || "Erro na autenticação com o YouTube.");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, apiBaseUrl]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#94a3b8",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(99, 102, 241, 0.2)",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ fontSize: 16 }}>Carregando dados para revisão...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f1f5f9",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: 24, marginBottom: 12, color: "#f43f5e" }}>
            Erro de Carregamento
          </h1>
          <p style={{ color: "#94a3b8", marginBottom: 24 }}>
            {error || "Não foi possível carregar os detalhes do projeto."}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#6366f1",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  const getVoiceName = () => {
    if (!project.voiceProfileId) return "Nenhuma selecionada";
    const profile = voiceProfiles.find((v) => v.id === project.voiceProfileId);
    return profile ? profile.name : `ID: ${project.voiceProfileId}`;
  };

  const formatDuration = (secs: number) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getVideoUrl = () => {
    if (!renderJob?.outputPath) return "";
    const relativeKey = renderJob.outputPath.replace(/^renders\//, "");
    return `${apiBaseUrl}/renders/${relativeKey}`;
  };

  const isRenderReady =
    renderJob?.status === "succeeded" && renderJob.outputPath;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        padding: "24px",
        boxSizing: "border-box",
        color: "#f1f5f9",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Top Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            paddingBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              id="back-to-edit"
              href={`/projects/${projectId}/edit`}
              style={{
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: 14,
                padding: "8px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontWeight: 500,
              }}
            >
              ← Voltar ao Editor
            </Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                Revisão do Vídeo
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0" }}>
                Projeto:{" "}
                <strong style={{ color: "#cbd5e1" }}>{project.title}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              id="review-status-label"
              style={{
                fontSize: 12,
                color: getStatusLabelAndStyle().color,
                background: getStatusLabelAndStyle().bg,
                border: getStatusLabelAndStyle().border,
                padding: "6px 14px",
                borderRadius: 20,
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              {getStatusLabelAndStyle().text}
            </span>
          </div>
        </header>

        {/* Content Columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 400px",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Left Column: Project Summary & Scenes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Project Summary Card */}
            <section
              id="project-summary-section"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: 16,
                padding: 24,
                backdropFilter: "blur(12px)",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: "0 0 16px 0",
                  color: "#f8fafc",
                }}
              >
                Metadados do Projeto
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Duração Estimada
                  </span>
                  <span
                    style={{ fontSize: 15, fontWeight: 600, color: "#cbd5e1" }}
                  >
                    {formatDuration(project.estimatedDuration)}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Perfil de Voz
                  </span>
                  <span
                    style={{ fontSize: 15, fontWeight: 600, color: "#cbd5e1" }}
                  >
                    {getVoiceName()}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Status do Projeto
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#cbd5e1",
                      textTransform: "capitalize",
                    }}
                  >
                    {project.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <form
                onSubmit={handleSave}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <label
                    htmlFor="metadata-title-input"
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#94a3b8",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    Título *
                  </label>
                  <input
                    id="metadata-title-input"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="metadata-input"
                    placeholder="Ex: Como programar em TypeScript"
                  />
                  {validationErrors.title && (
                    <span
                      id="metadata-validation-error-title"
                      style={{
                        display: "block",
                        color: "#f43f5e",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {validationErrors.title}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="metadata-description-input"
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#94a3b8",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    Descrição
                  </label>
                  <textarea
                    id="metadata-description-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="metadata-input"
                    rows={3}
                    placeholder="Descrição detalhada do projeto para publicação..."
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="metadata-tags-input"
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#94a3b8",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    Tags (separadas por vírgula)
                  </label>
                  <input
                    id="metadata-tags-input"
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="metadata-input"
                    placeholder="Ex: tutorial, programação, ts"
                  />
                  {validationErrors.tags && (
                    <span
                      id="metadata-validation-error-tags"
                      style={{
                        display: "block",
                        color: "#f43f5e",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {validationErrors.tags}
                    </span>
                  )}
                  <span
                    style={{
                      display: "block",
                      color: "#64748b",
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    Use vírgulas para separar as tags. Ex: tutorial, ts, web
                  </span>
                </div>

                {saveSuccess && (
                  <div
                    id="metadata-save-success"
                    style={{
                      color: "#10b981",
                      fontSize: 13,
                      background: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      textAlign: "center",
                    }}
                  >
                    {saveSuccess}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <button
                    id="save-metadata-btn"
                    type="submit"
                    disabled={isSaving}
                    className="save-btn"
                  >
                    {isSaving ? "Salvando..." : "Salvar Metadados"}
                  </button>
                </div>
              </form>
            </section>

            {/* Scenes Breakdown Card */}
            <section
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: 16,
                padding: 24,
                backdropFilter: "blur(12px)",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: "0 0 16px 0",
                  color: "#f8fafc",
                }}
              >
                Roteiro e Cenas ({scenes.length})
              </h2>

              {scenes.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
                  Nenhuma cena cadastrada para este projeto.
                </p>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {scenes.map((scene) => (
                    <div
                      key={scene.id}
                      style={{
                        padding: 16,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#a78bfa",
                          }}
                        >
                          {scene.title}
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          Cena #{scene.orderIndex + 1}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          color: "#cbd5e1",
                          margin: 0,
                          lineHeight: 1.6,
                        }}
                      >
                        {scene.script}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Player */}
          <div style={{ position: "sticky", top: 24 }}>
            <section
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: 16,
                padding: 24,
                backdropFilter: "blur(12px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: 0,
                  color: "#f8fafc",
                  width: "100%",
                }}
              >
                Player de Vídeo Final
              </h2>

              {!isRenderReady ? (
                <div
                  id="no-render-state"
                  style={{
                    width: "100%",
                    padding: "60px 20px",
                    border: "2px dashed rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 14,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span>
                    ⚠️ Vídeo não renderizado ou render ainda em progresso.
                  </span>
                  <Link
                    href={`/projects/${projectId}/edit`}
                    style={{
                      display: "inline-block",
                      fontSize: 13,
                      color: "#6366f1",
                      textDecoration: "underline",
                    }}
                  >
                    Ir para o Editor para Renderizar
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    id="video-player-container"
                    style={{
                      width: "100%",
                      maxWidth: 320,
                      aspectRatio: "9/16",
                      background: "#000",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <video
                      id="rendered-video-player"
                      src={getVideoUrl()}
                      controls
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                  <div
                    id="ready-for-review-state"
                    style={{
                      fontSize: 13,
                      color:
                        project.status === "approved"
                          ? "#10b981"
                          : project.status === "rejected"
                            ? "#f43f5e"
                            : "#10b981",
                      fontWeight: 500,
                      textAlign: "center",
                    }}
                  >
                    {project.status === "approved"
                      ? "Projeto aprovado com sucesso! Pronto para publicação."
                      : project.status === "rejected"
                        ? "Projeto rejeitado. Edite o roteiro ou mude as cenas para corrigir."
                        : "Pronto para revisão! Assista ao vídeo e verifique os metadados."}
                  </div>

                  {/* Approval/Rejection Actions */}
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      marginTop: 12,
                      paddingTop: 16,
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    {actionError && (
                      <div
                        id="action-error-message"
                        style={{
                          color: "#f43f5e",
                          fontSize: 13,
                          textAlign: "center",
                          background: "rgba(244, 63, 94, 0.1)",
                          border: "1px solid rgba(244, 63, 94, 0.2)",
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        {actionError}
                      </div>
                    )}

                    {publishError && (
                      <div
                        id="publish-error-message"
                        style={{
                          color: "#f43f5e",
                          fontSize: 13,
                          textAlign: "center",
                          background: "rgba(244, 63, 94, 0.1)",
                          border: "1px solid rgba(244, 63, 94, 0.2)",
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        {publishError}
                      </div>
                    )}

                    {publishSuccess && (
                      <div
                        id="publish-success-message"
                        style={{
                          color: "#10b981",
                          fontSize: 13,
                          textAlign: "center",
                          background: "rgba(16, 185, 129, 0.1)",
                          border: "1px solid rgba(16, 185, 129, 0.2)",
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        {publishSuccess}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12, width: "100%" }}>
                      <button
                        id="reject-project-btn"
                        type="button"
                        onClick={handleReject}
                        disabled={
                          isProcessingAction || project.status === "rejected"
                        }
                        style={{
                          flex: 1,
                          background:
                            project.status === "rejected"
                              ? "rgba(244, 63, 94, 0.15)"
                              : "transparent",
                          color: "#f43f5e",
                          border: "1px solid #f43f5e",
                          borderRadius: 8,
                          padding: "10px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor:
                            isProcessingAction || project.status === "rejected"
                              ? "not-allowed"
                              : "pointer",
                          opacity: isProcessingAction ? 0.6 : 1,
                          transition: "all 0.2s ease",
                        }}
                      >
                        {project.status === "rejected"
                          ? "Rejeitado"
                          : "Rejeitar"}
                      </button>

                      <button
                        id="approve-project-btn"
                        type="button"
                        onClick={handleApprove}
                        disabled={
                          isProcessingAction || project.status === "approved"
                        }
                        style={{
                          flex: 1,
                          background:
                            project.status === "approved"
                              ? "rgba(16, 185, 129, 0.2)"
                              : "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 16px",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor:
                            isProcessingAction || project.status === "approved"
                              ? "not-allowed"
                              : "pointer",
                          opacity: isProcessingAction ? 0.6 : 1,
                          boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {project.status === "approved"
                          ? "Aprovado ✓"
                          : "Aprovar"}
                      </button>
                    </div>

                    {/* YouTube Channel Connection */}
                    <div
                      id="youtube-channel-section"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        padding: "12px 16px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 8,
                        marginTop: 4,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#94a3b8",
                          }}
                        >
                          Canal do YouTube
                        </span>
                        {youtubeChannel ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#10b981",
                              fontWeight: 600,
                            }}
                          >
                            Conectado
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#f43f5e",
                              fontWeight: 600,
                            }}
                          >
                            Desconectado
                          </span>
                        )}
                      </div>

                      {isLoadingChannel ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>
                          Carregando canal...
                        </div>
                      ) : youtubeChannel ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {youtubeChannel.thumbnail && (
                            <img
                              src={youtubeChannel.thumbnail}
                              alt={youtubeChannel.title}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                              }}
                            />
                          )}
                          <div
                            style={{ display: "flex", flexDirection: "column" }}
                          >
                            <span
                              id="youtube-channel-title"
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#fff",
                              }}
                            >
                              {youtubeChannel.title}
                            </span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                              ID: {youtubeChannel.channelId}
                            </span>
                          </div>
                          <button
                            id="connect-youtube-btn"
                            type="button"
                            onClick={handleConnectYoutube}
                            style={{
                              marginLeft: "auto",
                              background: "transparent",
                              color: "#a78bfa",
                              border: "none",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Alterar
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 12,
                              color: "#94a3b8",
                              margin: 0,
                            }}
                          >
                            Conecte seu canal para publicar vídeos diretamente
                            do estúdio.
                          </p>
                          <button
                            id="connect-youtube-btn"
                            type="button"
                            onClick={handleConnectYoutube}
                            style={{
                              width: "100%",
                              background: "#ff0000",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "8px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "center",
                              transition: "background 0.2s",
                            }}
                          >
                            Conectar Canal
                          </button>
                        </div>
                      )}

                      {channelError && (
                        <div
                          id="youtube-error-message"
                          style={{
                            color: "#f43f5e",
                            fontSize: 11,
                            background: "rgba(244, 63, 94, 0.1)",
                            border: "1px solid rgba(244, 63, 94, 0.2)",
                            borderRadius: 6,
                            padding: "6px 10px",
                            marginTop: 4,
                          }}
                        >
                          {channelError}
                        </div>
                      )}
                    </div>

                    {/* Status de Publicação do YouTube ou Controles de Upload */}
                    {youtubeChannel &&
                    project.youtubePublishStatus &&
                    project.youtubePublishStatus !== "idle" ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          padding: 16,
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 8,
                          marginBottom: 16,
                        }}
                      >
                        {project.youtubePublishStatus === "uploading" && (
                          <div
                            id="youtube-status-uploading"
                            style={{ textAlign: "center", padding: 12 }}
                          >
                            <div
                              className="animate-spin"
                              style={{
                                margin: "0 auto 8px",
                                width: 24,
                                height: 24,
                                border: "3px solid #6366f1",
                                borderTopColor: "transparent",
                                borderRadius: "50%",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#a5b4fc",
                              }}
                            >
                              Enviando vídeo para o YouTube...
                            </span>
                          </div>
                        )}

                        {project.youtubePublishStatus === "processing" && (
                          <div
                            id="youtube-status-processing"
                            style={{ textAlign: "center", padding: 12 }}
                          >
                            <div
                              className="animate-pulse"
                              style={{
                                margin: "0 auto 8px",
                                width: 40,
                                height: 10,
                                background: "#6366f1",
                                borderRadius: 4,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#a5b4fc",
                              }}
                            >
                              Processando no YouTube...
                            </span>
                          </div>
                        )}

                        {project.youtubePublishStatus === "scheduled" && (
                          <div
                            id="youtube-status-scheduled"
                            style={{
                              borderLeft: "3px solid #8b5cf6",
                              paddingLeft: 10,
                            }}
                          >
                            <h4
                              style={{
                                margin: "0 0 4px 0",
                                fontSize: 13,
                                color: "#c084fc",
                                fontWeight: 600,
                              }}
                            >
                              Publicação Agendada
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                color: "#cbd5e1",
                              }}
                            >
                              Seu vídeo está agendado para:{" "}
                              <strong>{project.scheduledPublishAtLocal}</strong>{" "}
                              ({project.scheduledPublishTimezone})
                            </p>
                            {project.youtubeVideoId && (
                              <p
                                style={{
                                  margin: "6px 0 0 0",
                                  fontSize: 11,
                                  color: "#94a3b8",
                                }}
                              >
                                ID do Vídeo: {project.youtubeVideoId}
                              </p>
                            )}
                          </div>
                        )}

                        {project.youtubePublishStatus === "published" && (
                          <div
                            id="youtube-status-published"
                            style={{
                              borderLeft: "3px solid #10b981",
                              paddingLeft: 10,
                            }}
                          >
                            <h4
                              style={{
                                margin: "0 0 4px 0",
                                fontSize: 13,
                                color: "#34d399",
                                fontWeight: 600,
                              }}
                            >
                              Publicado com Sucesso!
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                color: "#cbd5e1",
                              }}
                            >
                              Vídeo disponível no YouTube.
                            </p>
                            <a
                              id="youtube-video-link"
                              href={`https://www.youtube.com/watch?v=${project.youtubeVideoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-block",
                                marginTop: 8,
                                fontSize: 12,
                                color: "#10b981",
                                fontWeight: 500,
                                textDecoration: "underline",
                              }}
                            >
                              Assistir no YouTube
                            </a>
                          </div>
                        )}

                        {project.youtubePublishStatus === "error" && (
                          <div
                            id="youtube-status-error"
                            style={{
                              borderLeft: "3px solid #f43f5e",
                              paddingLeft: 10,
                            }}
                          >
                            <h4
                              style={{
                                margin: "0 0 4px 0",
                                fontSize: 13,
                                color: "#fb7185",
                                fontWeight: 600,
                              }}
                            >
                              Erro na Publicação
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                color: "#e2e8f0",
                              }}
                            >
                              {project.youtubePublishError ||
                                "Ocorreu um erro desconhecido durante o upload."}
                            </p>
                            <button
                              id="retry-publish-btn"
                              type="button"
                              onClick={handleResetPublishStatus}
                              disabled={isPublishing}
                              style={{
                                marginTop: 12,
                                background: "#f43f5e",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 12px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: isPublishing
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: isPublishing ? 0.6 : 1,
                              }}
                            >
                              Tentar Novamente
                            </button>
                          </div>
                        )}

                        {project.youtubePublishStatus === "download_only" && (
                          <div
                            id="youtube-status-fallback"
                            style={{
                              borderLeft: "3px solid #f97316",
                              paddingLeft: 10,
                            }}
                          >
                            <h4
                              style={{
                                margin: "0 0 4px 0",
                                fontSize: 13,
                                color: "#fb923c",
                                fontWeight: 600,
                              }}
                            >
                              Fallback: Modo Apenas Download Ativo
                            </h4>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                color: "#cbd5e1",
                                lineHeight: "1.4",
                              }}
                            >
                              Limite de quota diária do YouTube excedido para
                              esta conta. A publicação automática está suspensa
                              temporariamente.
                            </p>
                            <p
                              style={{
                                margin: "6px 0 0 0",
                                fontSize: 12,
                                color: "#cbd5e1",
                              }}
                            >
                              O arquivo de vídeo renderizado foi preservado e
                              está disponível para download local imediato:
                            </p>
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                marginTop: 12,
                              }}
                            >
                              <a
                                id="download-fallback-video-btn"
                                href={getVideoUrl()}
                                download
                                style={{
                                  background: "#f97316",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "6px 12px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  textDecoration: "none",
                                  display: "inline-block",
                                  textAlign: "center",
                                }}
                              >
                                Download do Vídeo (.mp4)
                              </a>
                              <button
                                id="retry-publish-btn"
                                type="button"
                                onClick={handleResetPublishStatus}
                                disabled={isPublishing}
                                style={{
                                  background: "rgba(255, 255, 255, 0.08)",
                                  color: "#e2e8f0",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  borderRadius: 6,
                                  padding: "6px 12px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: isPublishing
                                    ? "not-allowed"
                                    : "pointer",
                                  opacity: isPublishing ? 0.6 : 1,
                                }}
                              >
                                Redefinir Status
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Controles de Agendamento */}
                        {youtubeChannel && (
                          <div
                            style={{
                              marginBottom: 16,
                              padding: 12,
                              background: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <input
                                id="schedule-publish-toggle"
                                type="checkbox"
                                checked={isScheduledMode}
                                onChange={(e) =>
                                  setIsScheduledMode(e.target.checked)
                                }
                                style={{
                                  accentColor: "#6366f1",
                                  width: 16,
                                  height: 16,
                                }}
                              />
                              <span>Agendar publicação no YouTube</span>
                            </label>

                            {isScheduledMode && (
                              <div
                                id="schedule-inputs-container"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                  marginTop: 4,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                  }}
                                >
                                  <span
                                    style={{ fontSize: 11, color: "#94a3b8" }}
                                  >
                                    Data e Hora Local:
                                  </span>
                                  <input
                                    id="scheduled-date-input"
                                    type="datetime-local"
                                    value={scheduledDateLocal}
                                    onChange={(e) =>
                                      setScheduledDateLocal(e.target.value)
                                    }
                                    style={{
                                      background: "rgba(0, 0, 0, 0.2)",
                                      border:
                                        "1px solid rgba(255, 255, 255, 0.1)",
                                      borderRadius: 6,
                                      color: "#fff",
                                      padding: "6px 10px",
                                      fontSize: 13,
                                      outline: "none",
                                    }}
                                  />
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                  }}
                                >
                                  <span
                                    style={{ fontSize: 11, color: "#94a3b8" }}
                                  >
                                    Fuso Horário:
                                  </span>
                                  <select
                                    id="scheduled-timezone-select"
                                    value={scheduledTimezone}
                                    onChange={(e) =>
                                      setScheduledTimezone(e.target.value)
                                    }
                                    style={{
                                      background: "rgba(0, 0, 0, 0.2)",
                                      border:
                                        "1px solid rgba(255, 255, 255, 0.1)",
                                      borderRadius: 6,
                                      color: "#fff",
                                      padding: "6px 10px",
                                      fontSize: 13,
                                      outline: "none",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <option
                                      value="America/Sao_Paulo"
                                      style={{ background: "#1e1b4b" }}
                                    >
                                      América/São Paulo (UTC-3)
                                    </option>
                                    <option
                                      value="Europe/London"
                                      style={{ background: "#1e1b4b" }}
                                    >
                                      Europa/Londres (UTC+1)
                                    </option>
                                    <option
                                      value="Asia/Tokyo"
                                      style={{ background: "#1e1b4b" }}
                                    >
                                      Ásia/Tóquio (UTC+9)
                                    </option>
                                    <option
                                      value="America/New_York"
                                      style={{ background: "#1e1b4b" }}
                                    >
                                      América/Nova Iorque (UTC-4)
                                    </option>
                                    <option
                                      value="UTC"
                                      style={{ background: "#1e1b4b" }}
                                    >
                                      UTC (UTC+0)
                                    </option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          id="publish-project-btn"
                          type="button"
                          onClick={handlePublish}
                          disabled={isPublishing}
                          style={{
                            width: "100%",
                            background:
                              project.status !== "approved" || !youtubeChannel
                                ? "rgba(99, 102, 241, 0.15)"
                                : "#6366f1",
                            color:
                              project.status !== "approved" || !youtubeChannel
                                ? "#94a3b8"
                                : "#fff",
                            border:
                              project.status !== "approved" || !youtubeChannel
                                ? "1px solid rgba(255, 255, 255, 0.1)"
                                : "none",
                            borderRadius: 8,
                            padding: "10px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: isPublishing ? "not-allowed" : "pointer",
                            opacity: isPublishing ? 0.6 : 1,
                            boxShadow:
                              project.status !== "approved" || !youtubeChannel
                                ? "none"
                                : "0 4px 12px rgba(99, 102, 241, 0.2)",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {isPublishing
                            ? "Publicando..."
                            : isScheduledMode
                              ? "Agendar Vídeo"
                              : "Publicar Vídeo"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
