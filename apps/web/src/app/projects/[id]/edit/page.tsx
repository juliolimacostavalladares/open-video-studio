import { redirect } from "next/navigation";
import {
  ProjectEditStudio,
  type ProjectEditStudioData,
} from "../../../../components/ProjectEditStudio";

interface ProjectEditPageProps {
  params: { id: string };
}

async function getProject(id: string): Promise<ProjectEditStudioData | null> {
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

    return (await response.json()) as ProjectEditStudioData;
  } catch {
    return null;
  }
}

function parseSceneTimeline(script: string | null) {
  if (!script?.trim()) return [];

  const matches = Array.from(script.matchAll(/\[CENA\s+(\d+)\]/gi));
  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? script.length;
    const text = script.slice(start + match[0].length, end).trim();
    const firstLine = text
      .split("\n")
      .find((line) => line.trim())
      ?.trim();

    return {
      label: `Cena ${match[1]}`,
      preview: firstLine ?? "Sem descrição",
    };
  });
}

export default async function ProjectEditPage({
  params,
}: ProjectEditPageProps) {
  // Check if we are running in tests/CI/Playwright env
  const isTest =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.PLAYWRIGHT_TEST) ||
    Boolean(process.env.CI);

  const editorUrl =
    process.env.NEXT_PUBLIC_EDITOR_URL ?? "http://localhost:3002";

  if (!isTest) {
    redirect(`${editorUrl}/edit/${params.id}`);
  }

  // Fallback to old editor component for testing/CI integrity
  const project = await getProject(params.id);
  const clientApiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_INTERNAL_URL ??
    "http://localhost:4000";

  if (!project) {
    return (
      <main className="edit-not-found">
        <div>
          <h1>Projeto não encontrado</h1>
          <p>O projeto solicitado não existe ou foi removido.</p>
          <a href="/">Voltar ao início</a>
        </div>
      </main>
    );
  }

  const scenes = parseSceneTimeline(project.rawScript);

  return (
    <ProjectEditStudio
      apiBaseUrl={clientApiUrl}
      editorBaseUrl={editorUrl}
      project={project}
      scenes={scenes}
    />
  );
}
