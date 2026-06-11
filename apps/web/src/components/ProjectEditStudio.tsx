"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Mic,
  Image,
  Video,
  ArrowLeft,
  ArrowRight,
  Play,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";

import { SceneAssetManager } from "./SceneAssetManager";
import { ScriptEditor } from "./ScriptEditor";
import { VideoPreviewPlayer } from "./VideoPreviewPlayer";
import { VoiceProfileManager } from "./VoiceProfileManager";

export interface ProjectEditStudioData {
  estimatedDuration: number;
  estimatedDurationMax: number;
  estimatedDurationMin: number;
  id: string;
  rawScript: string | null;
  status: string;
  title: string;
  voiceProfileId: string | null;
}

interface ScenePreview {
  label: string;
  preview: string;
}

interface ProjectEditStudioProps {
  apiBaseUrl: string;
  project: ProjectEditStudioData;
  scenes: ScenePreview[];
}

type ToolId = "script" | "voice" | "assets" | "render";

const tools: Array<{
  description: string;
  icon: LucideIcon;
  id: ToolId;
  label: string;
}> = [
  {
    description: "Roteiro e cenas",
    icon: FileText,
    id: "script",
    label: "Roteiro",
  },
  {
    description: "Voz e áudio",
    icon: Mic,
    id: "voice",
    label: "Voz",
  },
  {
    description: "Uploads visuais",
    icon: Image,
    id: "assets",
    label: "Cenas",
  },
  {
    description: "Prévia final",
    icon: Video,
    id: "render",
    label: "Render",
  },
];

function formatDuration(seconds: number) {
  if (!seconds) return "0 min";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function ProjectEditStudio({
  apiBaseUrl,
  project,
  scenes,
}: ProjectEditStudioProps) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const previewScene = useMemo(
    () =>
      scenes[0] ?? {
        label: "Cena 1",
        preview:
          project.rawScript?.trim() ||
          "Seu vídeo aparece aqui conforme o roteiro ganha cenas.",
      },
    [project.rawScript, scenes],
  );

  const activeToolData =
    activeTool === null
      ? null
      : (tools.find((tool) => tool.id === activeTool) ?? null);

  return (
    <main className="edit-studio">
      <header className="edit-topbar">
        <a aria-label="Voltar para projetos" className="edit-back" href="/">
          <ArrowLeft size={16} strokeWidth={2} />
          Projetos
        </a>

        <div className="edit-title-group">
          <span className="eyebrow">Open Video Studio</span>
          <h1>{project.title}</h1>
        </div>

        <div className="edit-topbar-actions">
          <span className="edit-runtime-pill">
            {formatDuration(project.estimatedDuration)}
          </span>
          <span className={`status status-${project.status}`}>
            {project.status}
          </span>
          <a
            className="button button-primary button-small"
            href={`/projects/${project.id}/review`}
          >
            Revisar
            <ArrowRight size={14} strokeWidth={2} style={{ marginLeft: 6 }} />
          </a>
        </div>
      </header>

      <div
        className={
          activeToolData ? "edit-shell edit-shell-drawer-open" : "edit-shell"
        }
      >
        <aside aria-label="Ferramentas do editor" className="edit-rail">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <button
                aria-current={activeTool === tool.id ? "page" : undefined}
                className={
                  activeTool === tool.id
                    ? "edit-rail-item edit-rail-item-active"
                    : "edit-rail-item"
                }
                key={tool.id}
                onClick={() =>
                  setActiveTool((current) =>
                    current === tool.id ? null : tool.id,
                  )
                }
                type="button"
              >
                <span>
                  <IconComponent size={20} strokeWidth={1.8} />
                </span>
                <strong>{tool.label}</strong>
              </button>
            );
          })}
        </aside>

        {activeToolData ? (
          <aside className="edit-tool-drawer">
            <div className="edit-tool-drawer-heading">
              <div>
                <span className="eyebrow">{activeToolData.description}</span>
                <h2>{activeToolData.label}</h2>
              </div>
              <button
                aria-label="Recolher painel"
                className="edit-drawer-close"
                onClick={() => setActiveTool(null)}
                type="button"
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            {activeTool === "script" ? (
              project.status === "error" && !project.rawScript?.trim() ? (
                <div className="edit-error-state" role="alert">
                  <h2>Roteiro não foi gerado</h2>
                  <p>
                    A criação deste projeto falhou durante a geração por IA.
                    Volte para a lista de projetos e crie novamente depois de
                    corrigir a configuração do provedor.
                  </p>
                </div>
              ) : (
                <ScriptEditor
                  apiBaseUrl={apiBaseUrl}
                  initialScript={project.rawScript ?? ""}
                  projectId={project.id}
                  projectTitle={project.title}
                />
              )
            ) : null}

            {activeTool === "voice" ? (
              <VoiceProfileManager
                apiBaseUrl={apiBaseUrl}
                initialVoiceProfileId={project.voiceProfileId}
                projectId={project.id}
              />
            ) : null}

            {activeTool === "assets" ? (
              <SceneAssetManager
                apiBaseUrl={apiBaseUrl}
                projectId={project.id}
              />
            ) : null}

            {activeTool === "render" ? (
              <VideoPreviewPlayer
                apiBaseUrl={apiBaseUrl}
                projectId={project.id}
              />
            ) : null}
          </aside>
        ) : null}

        <section className="edit-stage" aria-label="Pré-visualização do vídeo">
          <div className="edit-stage-header">
            <div>
              <h2>Composição vertical</h2>
            </div>
            <div className="edit-stage-metrics">
              <span>{scenes.length} cenas</span>
              <span>{formatDuration(project.estimatedDuration)}</span>
              <span>
                {formatDuration(project.estimatedDurationMin)} -{" "}
                {formatDuration(project.estimatedDurationMax)}
              </span>
            </div>
          </div>

          <div className="edit-canvas">
            <div className="edit-phone-frame">
              <div className="edit-phone-safe-area">
                <div className="edit-phone-media">
                  <span className="edit-phone-scene">{previewScene.label}</span>
                  <strong>{project.title}</strong>
                  <p>{previewScene.preview}</p>
                </div>
                <div className="edit-phone-caption">
                  <span>9:16</span>
                  <span>{project.status}</span>
                </div>
              </div>
            </div>
            <div className="edit-playback">
              <span>0:00</span>
              <button aria-label="Pré-visualizar vídeo" type="button">
                <Play size={16} fill="currentColor" />
              </button>
              <span>{formatDuration(project.estimatedDuration)}</span>
            </div>
          </div>

          <section aria-label="Timeline de cenas" className="edit-timeline">
            <div className="edit-time-ruler">
              <span>0s</span>
              <span>10s</span>
              <span>20s</span>
              <span>30s</span>
              <span>40s</span>
            </div>
            <div className="edit-timeline-lane">
              <strong>Adicionar elementos</strong>
            </div>
            <div className="edit-timeline-track">
              {scenes.length === 0 ? (
                <div className="edit-timeline-empty">Sem cenas demarcadas</div>
              ) : (
                scenes.map((scene, index) => (
                  <article
                    className="edit-timeline-clip"
                    key={`${scene.label}-${index}`}
                  >
                    <span>{scene.label}</span>
                    <p>{scene.preview}</p>
                  </article>
                ))
              )}
            </div>
            <div className="edit-timeline-lane">
              <strong>Adicionar áudio</strong>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
