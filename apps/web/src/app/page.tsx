"use client";

import { useEffect, useState } from "react";

interface Project {
  id: string;
  title: string;
  theme: string;
  tone: string;
  targetDuration: number;
  description: string | null;
  status: string;
  createdAt: string;
  estimatedDuration: number;
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal creation state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    theme: "",
    tone: "educativo",
    targetDuration: 5,
    description: "",
  });

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${apiBaseUrl}/projects`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Erro ao carregar a lista de projetos");
      }
      const data = (await res.json()) as Project[];
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão com a API");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "targetDuration" ? Number(value) : value,
    }));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.theme || !formData.targetDuration) {
      setCreationError("Título, tema e duração alvo são obrigatórios.");
      return;
    }

    setIsCreating(true);
    setCreationError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.message || "Erro ao criar projeto na API do backend."
        );
      }

      // Refresh list, close modal, and reset form
      await fetchProjects();
      setIsModalOpen(false);
      setFormData({
        title: "",
        theme: "",
        tone: "educativo",
        targetDuration: 5,
        description: "",
      });
    } catch (err) {
      setCreationError(
        err instanceof Error ? err.message : "Erro ao conectar ao servidor"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    const defaultStyle = {
      bg: "rgba(100, 116, 139, 0.15)",
      color: "#94a3b8",
      border: "1px solid rgba(100, 116, 139, 0.3)",
      text: status,
      animation: "",
    };

    switch (status) {
      case "scripting":
        return {
          bg: "rgba(168, 85, 247, 0.15)",
          color: "#c084fc",
          border: "1px solid rgba(168, 85, 247, 0.3)",
          text: "Gerando Roteiro (IA)",
          animation: "pulse 1.8s infinite ease-in-out",
        };
      case "rendering":
        return {
          bg: "rgba(59, 130, 246, 0.15)",
          color: "#60a5fa",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          text: "Renderizando",
          animation: "pulse 1.5s infinite ease-in-out",
        };
      case "ready_for_review":
        return {
          bg: "rgba(234, 179, 8, 0.15)",
          color: "#facc15",
          border: "1px solid rgba(234, 179, 8, 0.3)",
          text: "Aguardando Revisão",
          animation: "",
        };
      case "approved":
        return {
          bg: "rgba(16, 185, 129, 0.15)",
          color: "#34d399",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          text: "Aprovado",
          animation: "",
        };
      case "rejected":
        return {
          bg: "rgba(239, 68, 68, 0.15)",
          color: "#f87171",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          text: "Rejeitado",
          animation: "",
        };
      case "error":
        return {
          bg: "rgba(220, 38, 38, 0.2)",
          color: "#fca5a5",
          border: "1px solid rgba(220, 38, 38, 0.4)",
          text: "Erro",
          animation: "",
        };
      case "draft":
        return {
          bg: "rgba(148, 163, 184, 0.15)",
          color: "#cbd5e1",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          text: "Rascunho",
          animation: "",
        };
      default:
        return defaultStyle;
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        padding: "40px 24px",
        boxSizing: "border-box",
        color: "#f1f5f9",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 24,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                background: "linear-gradient(90deg, #f97316, #a855f7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Open Video Studio
            </h1>
            <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 14 }}>
              Crie, edite e publique vídeos automatizados com inteligência artificial.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "linear-gradient(90deg, #f97316 0%, #ea580c 100%)",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "12px 24px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(249, 115, 22, 0.3)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "0 6px 24px rgba(249, 115, 22, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(249, 115, 22, 0.3)";
            }}
          >
            + Novo Projeto
          </button>
        </header>

        {/* Info panel */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#fca5a5",
              borderRadius: 12,
              padding: 16,
              fontSize: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>⚠️ {error}</span>
            <button
              onClick={() => void fetchProjects()}
              style={{
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Dashboard Grid */}
        <section>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#64748b" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid rgba(255,255,255,0.1)",
                  borderTopColor: "#f97316",
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                  animation: "pulse 1s infinite linear",
                }}
              />
              Carregando projetos...
            </div>
          ) : projects.length === 0 ? (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px dashed rgba(255, 255, 255, 0.08)",
                borderRadius: 16,
                padding: "80px 24px",
                textAlign: "center",
              }}
            >
              <h2 style={{ fontSize: 18, color: "#e2e8f0", margin: "0 0 8px" }}>
                Nenhum projeto encontrado
              </h2>
              <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>
                Comece criando seu primeiro roteiro gerado por Inteligência Artificial.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: "10px 20px",
                  color: "#e2e8f0",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Criar Projeto
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {projects.map((project) => {
                const badge = getStatusBadgeStyles(project.status);
                return (
                  <div
                    key={project.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: 16,
                      padding: 20,
                      backdropFilter: "blur(12px)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 16,
                      transition: "transform 0.2s, border-color 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 20,
                            fontWeight: 600,
                            background: badge.bg,
                            color: badge.color,
                            border: badge.border,
                            animation: badge.animation,
                          }}
                        >
                          {badge.text}
                        </span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          {new Date(project.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          margin: "0 0 8px",
                          color: "#f8fafc",
                        }}
                      >
                        {project.title}
                      </h3>

                      {project.description && (
                        <p
                          style={{
                            color: "#94a3b8",
                            fontSize: 13,
                            lineHeight: 1.5,
                            margin: "0 0 12px",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {project.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#cbd5e1",
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          🎬 {project.theme}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#cbd5e1",
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          🎭 {project.tone}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#cbd5e1",
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          ⏱️ Alvo: {project.targetDuration} min
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: 14,
                        marginTop: 4,
                      }}
                    >
                      <a
                        href={`/projects/${project.id}/edit`}
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#f8fafc",
                          borderRadius: 8,
                          padding: "8px 0",
                          fontSize: 12,
                          fontWeight: 600,
                          textAlign: "center",
                          textDecoration: "none",
                          transition: "background 0.2s",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      >
                        📝 Editar Roteiro
                      </a>
                      <a
                        href={`/projects/${project.id}/review`}
                        style={{
                          background: "rgba(99,102,241,0.15)",
                          border: "1px solid rgba(99,102,241,0.25)",
                          color: "#c7d2fe",
                          borderRadius: 8,
                          padding: "8px 0",
                          fontSize: 12,
                          fontWeight: 600,
                          textAlign: "center",
                          textDecoration: "none",
                          transition: "background 0.2s",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.25)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.15)")}
                      >
                        👁️ Revisar & Publicar
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#1e1b4b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 500,
              padding: 28,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
              color: "#f1f5f9",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                Novo Vídeo com Roteiro IA
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#94a3b8",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>

            {creationError && (
              <p
                style={{
                  color: "#fda4af",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  margin: "0 0 16px",
                }}
              >
                ⚠️ {creationError}
              </p>
            )}

            <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#cbd5e1" }}>Título do Projeto</span>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Ex: Curiosidades sobre o Universo"
                  required
                  disabled={isCreating}
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#cbd5e1" }}>Tema Geral (Theme)</span>
                <input
                  type="text"
                  name="theme"
                  value={formData.theme}
                  onChange={handleInputChange}
                  placeholder="Ex: buracos negros, exploração espacial"
                  required
                  disabled={isCreating}
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>Tom do Vídeo</span>
                  <select
                    name="tone"
                    value={formData.tone}
                    onChange={handleInputChange}
                    disabled={isCreating}
                    style={{
                      background: "rgba(15,23,42,0.6)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none",
                    }}
                  >
                    <option value="educativo">Educativo</option>
                    <option value="motivador">Motivador</option>
                    <option value="curioso">Curioso / Misterioso</option>
                    <option value="engraçado">Divertido</option>
                    <option value="serio">Sério / Jornalístico</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>Duração Alvo (min)</span>
                  <input
                    type="number"
                    name="targetDuration"
                    value={formData.targetDuration}
                    onChange={handleInputChange}
                    min="1"
                    max="120"
                    required
                    disabled={isCreating}
                    style={{
                      background: "rgba(15,23,42,0.6)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#cbd5e1" }}>Contexto Adicional (opcional)</span>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Instruções ou referências para a IA estruturar o roteiro..."
                  disabled={isCreating}
                  rows={3}
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#fff",
                    fontSize: 14,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "10px 18px",
                    color: "#cbd5e1",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    background: "linear-gradient(90deg, #f97316 0%, #ea580c 100%)",
                    color: "#fff",
                    border: 0,
                    borderRadius: 10,
                    padding: "10px 24px",
                    fontWeight: 600,
                    cursor: isCreating ? "wait" : "pointer",
                  }}
                >
                  {isCreating ? "Gerando Roteiro (IA)..." : "Confirmar & Gerar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
