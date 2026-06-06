import { ScriptEditor } from "../../../../components/ScriptEditor";

interface ProjectEditPageProps {
  params: { id: string };
}

interface ProjectData {
  id: string;
  title: string;
  rawScript: string | null;
  status: string;
}

async function getProject(id: string): Promise<ProjectData | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  try {
    const response = await fetch(`${apiUrl}/projects/${id}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ProjectData;
  } catch {
    return null;
  }
}

export default async function ProjectEditPage({ params }: ProjectEditPageProps) {
  const project = await getProject(params.id);

  if (!project) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f1f5f9"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Projeto não encontrado</h1>
          <p style={{ color: "#94a3b8" }}>O projeto solicitado não existe ou foi removido.</p>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "#6366f1",
              textDecoration: "underline",
              fontSize: 14
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
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        padding: "24px",
        boxSizing: "border-box"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * { font-family: 'Inter', system-ui, sans-serif; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20
        }}
      >
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="/"
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
              transition: "background 0.2s"
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
              letterSpacing: "0.05em"
            }}
          >
            {project.status}
          </span>
        </header>

        {/* Editor */}
        <section
          aria-label="Editor de roteiro"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: 24,
            backdropFilter: "blur(12px)"
          }}
        >
          <ScriptEditor
            projectId={project.id}
            initialScript={project.rawScript ?? ""}
            projectTitle={project.title}
          />
        </section>

        {/* Dica de uso */}
        <p
          style={{
            color: "#475569",
            fontSize: 12,
            textAlign: "center",
            margin: 0
          }}
        >
          Use <code style={{ color: "#6366f1" }}>[CENA 1]</code>,{" "}
          <code style={{ color: "#6366f1" }}>[CENA 2]</code>... para demarcar cenas.
          O roteiro é salvo automaticamente após 1,5s sem edição.
        </p>
      </div>
    </main>
  );
}
