import { ScriptEditor } from "../../../../components/ScriptEditor";
import { VoiceProfileManager } from "../../../../components/VoiceProfileManager";
import { SceneAssetManager } from "../../../../components/SceneAssetManager";
import { VideoPreviewPlayer } from "../../../../components/VideoPreviewPlayer";

interface ProjectEditPageProps {
  params: { id: string };
}

interface ProjectData {
  id: string;
  title: string;
  rawScript: string | null;
  status: string;
  voiceProfileId: string | null;
}

async function getProject(id: string): Promise<ProjectData | null> {
  const apiUrl =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";

  try {
    const response = await fetch(`${apiUrl}/projects/${id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ProjectData;
  } catch {
    return null;
  }
}

export default async function ProjectEditPage({
  params,
}: ProjectEditPageProps) {
  const project = await getProject(params.id);
  const clientApiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_INTERNAL_URL ??
    "http://localhost:4000";

  if (!project) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f1f5f9",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>
            Projeto não encontrado
          </h1>
          <p style={{ color: "#94a3b8" }}>
            O projeto solicitado não existe ou foi removido.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "#6366f1",
              textDecoration: "underline",
              fontSize: 14,
            }}
          >
            Voltar ao início
          </a>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "transparent",
        padding: "32px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <a
            href="/projects"
            aria-label="Voltar"
            style={{
              color: "#94a3b8",
              textDecoration: "none",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              transition: "background 0.2s",
            }}
          >
            ← Projetos
          </a>

          <div style={{ flex: 1 }} />

          <span
            style={{
              fontSize: 11,
              color: "#64748b",
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {project.status}
          </span>
          <a
            href={`/projects/${project.id}/review`}
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              padding: "9px 14px",
              borderRadius: 9,
              background: "#7657ff",
            }}
          >
            Abrir revisão →
          </a>
        </header>

        <nav
          aria-label="Etapas do projeto"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(255,255,255,0.025)",
          }}
        >
          {[
            ["01", "Roteiro", "Edite a narrativa"],
            ["02", "Voz e áudio", "Defina a narração"],
            ["03", "Cenas", "Escolha os visuais"],
            ["04", "Render", "Finalize o vídeo"],
          ].map(([number, label, description], index) => (
            <div
              key={number}
              style={{
                padding: "15px 16px",
                borderRight:
                  index < 3 ? "1px solid rgba(255,255,255,0.07)" : 0,
              }}
            >
              <span
                style={{ color: "#8b7cff", fontSize: 10, fontWeight: 800 }}
              >
                {number}
              </span>
              <strong
                style={{
                  color: "#f8fafc",
                  display: "block",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {label}
              </strong>
              <small style={{ color: "#64748b", fontSize: 10 }}>
                {description}
              </small>
            </div>
          ))}
        </nav>

        {/* Editor */}
        <section
          aria-label="Editor de roteiro"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: 24,
            backdropFilter: "blur(12px)",
          }}
        >
          {project.status === "error" && !project.rawScript?.trim() ? (
            <div
              role="alert"
              style={{
                color: "#fecaca",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <h2 style={{ color: "#fee2e2", fontSize: 18, margin: "0 0 8px" }}>
                Roteiro não foi gerado
              </h2>
              <p style={{ color: "#fca5a5", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                A criação deste projeto falhou durante a geração por IA. Volte para a lista
                de projetos e crie novamente depois de corrigir a configuração do provedor.
              </p>
            </div>
          ) : (
            <ScriptEditor
              projectId={project.id}
              initialScript={project.rawScript ?? ""}
              projectTitle={project.title}
              apiBaseUrl={clientApiUrl}
            />
          )}
        </section>

        <VoiceProfileManager
          apiBaseUrl={clientApiUrl}
          initialVoiceProfileId={project.voiceProfileId}
          projectId={project.id}
        />

        <SceneAssetManager apiBaseUrl={clientApiUrl} projectId={project.id} />

        <VideoPreviewPlayer apiBaseUrl={clientApiUrl} projectId={project.id} />

        {/* Dica de uso */}
        <p
          style={{
            color: "#475569",
            fontSize: 12,
            textAlign: "center",
            margin: 0,
          }}
        >
          Use <code style={{ color: "#6366f1" }}>[CENA 1]</code>,{" "}
          <code style={{ color: "#6366f1" }}>[CENA 2]</code>... para demarcar
          cenas. O roteiro é salvo automaticamente após 1,5s sem edição.
        </p>
      </div>
    </main>
  );
}
