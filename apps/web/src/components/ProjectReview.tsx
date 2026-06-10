"use client";

import React, { useState, useEffect } from "react";
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

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/publish`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Falha ao publicar o projeto");
      }
      setPublishSuccess(data.message || "Vídeo publicado com sucesso!");
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Erro ao publicar projeto",
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

  useEffect(() => {
    let active = true;

    async function loadData() {
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

        if (!active) return;
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
          // The API returns { projectId, scenes: [...] } or just [...]
          const scenesList = Array.isArray(scenesData)
            ? scenesData
            : scenesData.scenes || [];
          setScenes(
            scenesList.sort(
              (a: Scene, b: Scene) => a.orderIndex - b.orderIndex,
            ),
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
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro desconhecido");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
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
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', system-ui, sans-serif; }
        .metadata-input {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 14px;
          color: #f1f5f9;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .metadata-input:focus {
          border-color: #6366f1;
          background: rgba(0, 0, 0, 0.35);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        .save-btn {
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .save-btn:hover:not(:disabled) {
          background: #4f46e5;
          transform: translateY(-1px);
        }
        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

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

                    <button
                      id="publish-project-btn"
                      type="button"
                      onClick={handlePublish}
                      disabled={isPublishing}
                      style={{
                        width: "100%",
                        background:
                          project.status !== "approved"
                            ? "rgba(99, 102, 241, 0.15)"
                            : "#6366f1",
                        color:
                          project.status !== "approved" ? "#94a3b8" : "#fff",
                        border:
                          project.status !== "approved"
                            ? "1px solid rgba(255, 255, 255, 0.1)"
                            : "none",
                        borderRadius: 8,
                        padding: "10px 16px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isPublishing ? "not-allowed" : "pointer",
                        opacity: isPublishing ? 0.6 : 1,
                        boxShadow:
                          project.status !== "approved"
                            ? "none"
                            : "0 4px 12px rgba(99, 102, 241, 0.2)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isPublishing ? "Publicando..." : "Publicar Vídeo"}
                    </button>
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
