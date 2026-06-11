import { ProjectDashboard, type ProjectSummary } from "../components/ProjectDashboard";
import { getServerApiUrl } from "../lib/api";

async function getProjects() {
  try {
    const response = await fetch(`${getServerApiUrl()}/projects`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as { projects: ProjectSummary[] };
    return { projects: body.projects };
  } catch (error) {
    return {
      projects: [],
      error: error instanceof Error ? error.message : "Falha de conexão",
    };
  }
}

export default async function HomePage() {
  const result = await getProjects();
  return <ProjectDashboard connectionError={result.error} projects={result.projects} />;
}
