"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Mic,
  Image as ImageIcon,
  ArrowLeft,
  ArrowRight,
  Play,
  ChevronLeft,
  type LucideIcon,
  Video,
} from "lucide-react";

import { SceneAssetManager } from "./SceneAssetManager";
import { VoiceProfileManager } from "./VoiceProfileManager";
import { calculateEstimatedDuration } from "../utils/duration";

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

interface Scene {
  id: string;
  title: string;
  script: string;
  orderIndex: number;
  status: string;
  audioPath?: string | null;
  audioDurationSeconds?: number | null;
  hasValidAudio?: boolean;
  assetId?: string | null;
  asset?: {
    id: string;
    kind: "image" | "video";
    path: string;
    source: string;
    status: string;
  } | null;
}

interface ProjectEditStudioProps {
  apiBaseUrl: string;
  project: ProjectEditStudioData;
  scenes: Array<{ label: string; preview: string }>;
}

type ToolId = "assets" | "voice";

const tools: Array<{
  description: string;
  icon: LucideIcon;
  id: ToolId;
  label: string;
}> = [
  {
    description: "Uploads de mídias",
    icon: ImageIcon,
    id: "assets",
    label: "Mídias",
  },
  {
    description: "Narrações das cenas",
    icon: Mic,
    id: "voice",
    label: "Voz",
  },
];

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export function ProjectEditStudio({
  apiBaseUrl,
  project,
}: ProjectEditStudioProps) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [scenesList, setScenesList] = useState<Scene[]>([]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [hoveredSceneTimelineId, setHoveredSceneTimelineId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedScripts, setEditedScripts] = useState<Record<string, string>>(
    {},
  );

  const estimatedDurationData = useMemo(() => {
    if (scenesList.length === 0) {
      return {
        average: project.estimatedDuration,
        min: project.estimatedDurationMin,
        max: project.estimatedDurationMax,
      };
    }
    const combinedScript = scenesList
      .map((s) => {
        const edited = editedScripts[s.id];
        return edited !== undefined ? edited : s.script;
      })
      .join("\n");
    return calculateEstimatedDuration(combinedScript);
  }, [scenesList, editedScripts, project]);

  const loadScenesList = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/projects/${project.id}/scenes`,
          {
            cache: "no-store",
            signal,
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const body = (await response.json()) as { scenes: Scene[] };
        setScenesList(body.scenes);
      } catch (error) {
        console.error("Erro ao carregar cenas no ProjectEditStudio:", error);
      }
    },
    [apiBaseUrl, project.id],
  );

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await loadScenesList();
      setIsLoading(false);
    }
    void init();

    // Listen to external scenes update events from the drawer components
    const handleExternalUpdate = () => {
      void loadScenesList();
    };
    window.addEventListener(
      "open-video-studio:scenes-updated",
      handleExternalUpdate,
    );
    return () => {
      window.removeEventListener(
        "open-video-studio:scenes-updated",
        handleExternalUpdate,
      );
    };
  }, [loadScenesList]);

  async function handleAssociateAsset(sceneId: string, assetId: string | null) {
    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${project.id}/scenes/${sceneId}/asset`,
        {
          body: JSON.stringify({ assetId }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      if (response.ok) {
        await loadScenesList();
        // Dispatch event to notify drawer components too
        window.dispatchEvent(
          new CustomEvent("open-video-studio:scenes-updated", {
            detail: { projectId: project.id },
          }),
        );
      }
    } catch (error) {
      console.error("Erro ao associar asset na timeline:", error);
    }
  }

  const activeToolData =
    activeTool === null
      ? null
      : (tools.find((tool) => tool.id === activeTool) ?? null);

  const currentScene = scenesList[selectedSceneIndex];

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
            {formatDuration(estimatedDurationData.average)}
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

        <aside
          className="edit-tool-drawer"
          style={{ display: activeToolData ? "block" : "none" }}
        >
          <div className="edit-tool-drawer-heading">
            <div>
              <span className="eyebrow">{activeToolData?.description}</span>
              <h2>{activeToolData?.label}</h2>
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

          <div style={{ display: activeTool === "voice" ? "block" : "none" }}>
            <VoiceProfileManager
              apiBaseUrl={apiBaseUrl}
              initialVoiceProfileId={project.voiceProfileId}
              projectId={project.id}
              onScriptsChange={setEditedScripts}
              selectedSceneId={currentScene?.id || null}
            />
          </div>

          <div style={{ display: activeTool === "assets" ? "block" : "none" }}>
            <SceneAssetManager
              apiBaseUrl={apiBaseUrl}
              projectId={project.id}
              selectedSceneId={currentScene?.id || null}
            />
          </div>
        </aside>

        <section className="edit-stage" aria-label="Pré-visualização do vídeo">
          <div className="edit-stage-header">
            <div>
              <h2>Composição vertical</h2>
            </div>
            <div className="edit-stage-metrics">
              <span>{scenesList.length} cenas</span>
              <span
                id="estimated-duration"
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
              >
                <span>{formatDuration(estimatedDurationData.average)}</span>
                <span style={{ opacity: 0.6, fontSize: 11 }}>
                  ({formatDuration(estimatedDurationData.min)} -{" "}
                  {formatDuration(estimatedDurationData.max)})
                </span>
              </span>
            </div>
          </div>

          <div className="edit-canvas">
            <div className="edit-phone-frame">
              <div className="edit-phone-safe-area">
                {isLoading ? (
                  <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-500 text-xs animate-pulse">
                    Carregando preview...
                  </div>
                ) : currentScene ? (
                  <div className="w-full h-full relative overflow-hidden bg-slate-950">
                    {/* Media Preview inside phone frame */}
                    {currentScene.asset &&
                    currentScene.asset.path !==
                      "assets/fallbacks/default-placeholder.png" ? (
                      currentScene.asset.kind === "video" ? (
                        <video
                          src={`${apiBaseUrl}/${currentScene.asset.path}`}
                          autoPlay
                          loop
                          muted
                          playsInline
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <img
                          src={`${apiBaseUrl}/${currentScene.asset.path}`}
                          alt="Preview Visual"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      )
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
                        style={{
                          background:
                            "radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(9,12,21,1) 100%)",
                        }}
                      >
                        <span className="text-[10px] text-amber-500 font-semibold tracking-wider uppercase bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 mb-3 animate-pulse">
                          ⚠️ Fallback Visual Ativo
                        </span>
                        <p className="text-xs text-slate-500 max-w-[200px]">
                          Arraste uma mídia da aba do editor para esta cena
                        </p>
                      </div>
                    )}

                    {/* Subtitle / Script overlay */}
                    <div className="absolute inset-x-0 bottom-12 px-6 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                      <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest block mb-1">
                        {currentScene.title}
                      </span>
                      <p className="text-xs font-semibold text-white leading-relaxed line-clamp-3">
                        {currentScene.script}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                    <p className="text-xs">Nenhuma cena ativa selecionada.</p>
                  </div>
                )}
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
              <span>{formatDuration(estimatedDurationData.average)}</span>
            </div>
          </div>

          <section
            aria-label="Timeline de cenas"
            className="edit-timeline-double"
          >
            {/* Header / Ruler Row */}
            <div
              className="timeline-track-row"
              style={{
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                paddingBottom: 4,
              }}
            >
              <div
                className="timeline-track-label"
                style={{ color: "rgba(255, 255, 255, 0.3)" }}
              >
                Canais
              </div>
              <div
                className="flex justify-between text-[10px] text-slate-500 font-semibold px-2"
                style={{ flex: 1 }}
              >
                <span>0s</span>
                <span>10s</span>
                <span>20s</span>
                <span>30s</span>
                <span>40s</span>
              </div>
            </div>

            {/* Visual Track Row */}
            <div className="timeline-track-row">
              <div className="timeline-track-label">
                <Video size={13} className="text-violet-400" />
                <span>Visual</span>
              </div>
              <div className="timeline-track-content">
                {isLoading ? (
                  <div className="text-xs text-slate-500 animate-pulse py-4">
                    Carregando timeline...
                  </div>
                ) : scenesList.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4">Sem cenas</div>
                ) : (
                  scenesList.map((scene, index) => {
                    const hasAsset =
                      scene.asset &&
                      scene.asset.path !==
                        "assets/fallbacks/default-placeholder.png";
                    const isActive =
                      index === selectedSceneIndex && activeTool === "assets";

                    return (
                      <div
                        key={`visual-${scene.id}`}
                        onClick={() => {
                          setSelectedSceneIndex(index);
                          setActiveTool("assets");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setHoveredSceneTimelineId(scene.id);
                        }}
                        onDragLeave={() => setHoveredSceneTimelineId(null)}
                        onDrop={async (e) => {
                          e.preventDefault();
                          setHoveredSceneTimelineId(null);
                          const assetId = e.dataTransfer.getData("text/plain");
                          if (assetId) {
                            await handleAssociateAsset(scene.id, assetId);
                          }
                        }}
                        className={`timeline-visual-block ${isActive ? "active" : ""} ${
                          hoveredSceneTimelineId === scene.id
                            ? "edit-timeline-clip-hovered border-violet-500"
                            : ""
                        }`}
                        style={{
                          background: hasAsset
                            ? undefined
                            : "radial-gradient(circle, rgba(139,92,246,0.05) 0%, rgba(9,12,21,0.9) 100%)",
                        }}
                      >
                        {hasAsset ? (
                          scene.asset!.kind === "video" ? (
                            <div className="w-full h-full relative">
                              <video
                                src={`${apiBaseUrl}/${scene.asset!.path}`}
                                className="w-full h-full object-cover"
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Video
                                  size={12}
                                  className="text-white drop-shadow"
                                />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={`${apiBaseUrl}/${scene.asset!.path}`}
                              alt="Thumbnail"
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-700">
                            <ImageIcon size={14} />
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider">
                          {scene.title}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Audio Track Row */}
            <div className="timeline-track-row">
              <div className="timeline-track-label">
                <Mic size={13} className="text-violet-400" />
                <span>Narrações</span>
              </div>
              <div className="timeline-track-content">
                {isLoading ? (
                  <div className="text-xs text-slate-500 animate-pulse py-2">
                    Carregando timeline...
                  </div>
                ) : scenesList.length === 0 ? (
                  <div className="text-xs text-slate-500 py-2">
                    Sem narrações
                  </div>
                ) : (
                  scenesList.map((scene, index) => {
                    const isActive =
                      index === selectedSceneIndex && activeTool === "voice";
                    const hasAudio = scene.hasValidAudio;

                    return (
                      <div
                        key={`audio-${scene.id}`}
                        onClick={() => {
                          setSelectedSceneIndex(index);
                          setActiveTool("voice");
                        }}
                        className={`timeline-audio-block ${isActive ? "active" : ""}`}
                      >
                        {hasAudio ? (
                          <div className="audio-wave-snippet">
                            <div
                              className="audio-wave-bar"
                              style={{ height: "45%" }}
                            />
                            <div
                              className="audio-wave-bar"
                              style={{ height: "90%" }}
                            />
                            <div
                              className="audio-wave-bar"
                              style={{ height: "35%" }}
                            />
                            <div
                              className="audio-wave-bar"
                              style={{ height: "70%" }}
                            />
                            <span className="text-[9px] text-emerald-400 font-semibold font-mono ml-1">
                              {scene.audioDurationSeconds
                                ? `${Math.round(scene.audioDurationSeconds)}s`
                                : "TTS"}
                            </span>
                          </div>
                        ) : (
                          <div className="audio-wave-snippet">
                            <div
                              className="audio-wave-bar pending"
                              style={{ height: "20%" }}
                            />
                            <div
                              className="audio-wave-bar pending"
                              style={{ height: "20%" }}
                            />
                            <div
                              className="audio-wave-bar pending"
                              style={{ height: "20%" }}
                            />
                            <span className="text-[9px] text-amber-500 font-medium ml-1">
                              Sem áudio
                            </span>
                          </div>
                        )}
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block truncate max-w-[50px] ml-auto">
                          {scene.title}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
