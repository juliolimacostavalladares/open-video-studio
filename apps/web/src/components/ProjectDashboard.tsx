"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ArrowIcon, FilmIcon, PlusIcon, SearchIcon, SparkIcon } from "./icons";

export interface ProjectSummary {
  id: string;
  title: string;
  description: string | null;
  theme: string;
  tone: string;
  status: string;
  sceneCount: number;
  estimatedDuration: number;
  updatedAt: string;
  latestRender: {
    status: string;
    outputPath: string | null;
  } | null;
  voiceProfile: {
    id: string;
    name: string;
  } | null;
}

const statusLabels: Record<string, string> = {
  approved: "Aprovado",
  draft: "Rascunho",
  error: "Atenção",
  ready_for_review: "Em revisão",
  rejected: "Ajustes pedidos",
  rendering: "Renderizando",
  scripting: "Em produção",
};

function formatDuration(seconds: number) {
  if (!seconds) return "0 min";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function ProjectDashboard({
  projects,
  connectionError,
}: {
  projects: ProjectSummary[];
  connectionError?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const matchesQuery = `${project.title} ${project.theme}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          ["draft", "scripting", "rendering"].includes(project.status)) ||
        (filter === "review" && project.status === "ready_for_review") ||
        (filter === "done" &&
          ["approved", "rejected"].includes(project.status));
      return matchesQuery && matchesFilter;
    });
  }, [filter, projects, query]);

  const activeCount = projects.filter((project) =>
    ["draft", "scripting", "rendering"].includes(project.status),
  ).length;
  const reviewCount = projects.filter(
    (project) => project.status === "ready_for_review",
  ).length;
  const readyCount = projects.filter(
    (project) => project.latestRender?.status === "succeeded",
  ).length;

  return (
    <div className="page">
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">Seu estúdio de conteúdo</span>
          <h1>Transforme ideias em vídeos prontos para publicar.</h1>
          <p>
            Organize roteiro, voz, cenas, render e distribuição em um único fluxo.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/projects/new">
              <SparkIcon />
              Criar com IA
            </Link>
            <a className="button button-secondary" href="#projects">
              Ver projetos
            </a>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-core"><FilmIcon /></span>
          <span className="orbit-node node-one">AI</span>
          <span className="orbit-node node-two">HD</span>
          <span className="orbit-node node-three">9:16</span>
        </div>
      </div>

      {connectionError ? (
        <div className="notice notice-error">
          <strong>API indisponível</strong>
          <span>{connectionError}. Confirme que `pnpm dev` está executando.</span>
        </div>
      ) : null}

      <section className="metric-grid" aria-label="Resumo do workspace">
        <article className="metric-card">
          <span>Projetos totais</span>
          <strong>{projects.length}</strong>
          <small>Conteúdos no workspace</small>
        </article>
        <article className="metric-card accent-cyan">
          <span>Em produção</span>
          <strong>{activeCount}</strong>
          <small>Roteiro, áudio ou render</small>
        </article>
        <article className="metric-card accent-purple">
          <span>Aguardando revisão</span>
          <strong>{reviewCount}</strong>
          <small>Prontos para sua decisão</small>
        </article>
        <article className="metric-card accent-green">
          <span>Vídeos renderizados</span>
          <strong>{readyCount}</strong>
          <small>Arquivos finais disponíveis</small>
        </article>
      </section>

      <section className="section-block" id="projects">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Produção</span>
            <h2>Projetos recentes</h2>
          </div>
          <Link className="button button-secondary button-small" href="/projects/new">
            <PlusIcon />
            Novo projeto
          </Link>
        </div>

        <div className="project-toolbar">
          <label className="search-field">
            <SearchIcon />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título ou tema"
              value={query}
            />
          </label>
          <div className="filter-tabs">
            {([
              ["all", "Todos"],
              ["active", "Em produção"],
              ["review", "Revisão"],
              ["done", "Concluídos"],
            ] as const).map(([value, label]) => (
              <button
                className={filter === value ? "active" : ""}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><FilmIcon /></span>
            <h3>{projects.length === 0 ? "Seu primeiro vídeo começa aqui" : "Nenhum projeto encontrado"}</h3>
            <p>
              {projects.length === 0
                ? "Descreva uma ideia e deixe a IA criar o primeiro roteiro."
                : "Tente outro termo ou remova os filtros ativos."}
            </p>
            {projects.length === 0 ? (
              <Link className="button button-primary" href="/projects/new">
                <PlusIcon />
                Criar primeiro projeto
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="project-grid">
            {filtered.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-cover">
                  <span className="project-format">9:16</span>
                  <span className="project-cover-icon"><FilmIcon /></span>
                  {project.latestRender?.status === "succeeded" ? (
                    <span className="render-ready">Render pronto</span>
                  ) : null}
                </div>
                <div className="project-content">
                  <div className="project-meta">
                    <span className={`status status-${project.status}`}>
                      {statusLabels[project.status] ?? project.status}
                    </span>
                    <time>{new Date(project.updatedAt).toLocaleDateString("pt-BR")}</time>
                  </div>
                  <h3>{project.title}</h3>
                  <p>{project.description || project.theme || "Projeto de vídeo sem descrição."}</p>
                  <div className="project-details">
                    <span>{project.sceneCount} cenas</span>
                    <span>{formatDuration(project.estimatedDuration)}</span>
                    <span>{project.voiceProfile?.name ?? "Sem voz"}</span>
                  </div>
                  <Link className="project-link" href={`/projects/${project.id}/edit`}>
                    Continuar produção
                    <ArrowIcon />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
