"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Mic,
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  RefreshCw,
  Save,
  VolumeX,
} from "lucide-react";

interface Scene {
  id: string;
  title: string;
  script: string;
  orderIndex: number;
  status: string;
  audioPath?: string | null;
  audioDurationSeconds?: number | null;
  hasValidAudio?: boolean;
}

interface VoiceProfileManagerProps {
  apiBaseUrl: string;
  initialVoiceProfileId: string | null;
  projectId: string;
  onScriptsChange?: (scripts: Record<string, string>) => void;
  selectedSceneId: string | null;
}

export function VoiceProfileManager({
  apiBaseUrl,
  projectId,
  onScriptsChange,
  selectedSceneId,
}: VoiceProfileManagerProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const selectedScene = scenes.find((s) => s.id === selectedSceneId);
  const [mounted, setMounted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(
    null,
  );
  const [editedScripts, setEditedScripts] = useState<Record<string, string>>(
    {},
  );
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (onScriptsChange) {
      onScriptsChange(editedScripts);
    }
  }, [editedScripts, onScriptsChange]);

  const loadScenes = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/projects/${projectId}/scenes`,
          {
            cache: "no-store",
            signal,
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(body.message ?? `HTTP ${response.status}`);
        }

        const body = (await response.json()) as { scenes: Scene[] };
        setScenes(body.scenes);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setErrorMessage(error.message);
        }
      }
    },
    [apiBaseUrl, projectId],
  );

  const hydrate = useCallback(async () => {
    setIsLoading(true);
    await loadScenes();
    setIsLoading(false);
  }, [loadScenes]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void hydrate();

    // Listen for external scenes update events (e.g. from assets drag-drop)
    const handleExternalUpdate = () => {
      void loadScenes();
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
  }, [hydrate, loadScenes, mounted]);

  // Handle local narration audio playback preview
  function playAudio(sceneId: string, audioPath: string) {
    if (playingSceneId === sceneId) {
      audioRef.current?.pause();
      setPlayingSceneId(null);
      return;
    }

    const url = `${apiBaseUrl}/${audioPath}`;
    setAudioPreviewUrl(url);
    setPlayingSceneId(sceneId);

    // React to end of audio
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch((err) => {
          console.error("Erro ao tocar áudio:", err);
          setPlayingSceneId(null);
        });
      }
    }, 50);
  }

  async function handleSingleSceneGenerate(sceneId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratingSceneId(sceneId);

    try {
      const currentText = editedScripts[sceneId];
      if (currentText !== undefined) {
        // Save the script text first
        const patchResponse = await fetch(
          `${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}`,
          {
            body: JSON.stringify({ script: currentText }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          },
        );

        if (!patchResponse.ok) {
          const errBody = await patchResponse.json().catch(() => ({}));
          throw new Error(errBody.message ?? "Erro ao salvar roteiro da cena");
        }
      }

      // Generate the narration audio
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes/audio/generate`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message ?? `HTTP ${response.status}`);
      }

      await response.json().catch(() => ({}));
      setSuccessMessage(`Narração da cena gerada com sucesso!`);

      // Clear dirty state for this scene
      setEditedScripts((prev) => {
        const copy = { ...prev };
        delete copy[sceneId];
        return copy;
      });

      // Notify parent about scene changes
      window.dispatchEvent(
        new CustomEvent("open-video-studio:scenes-updated", {
          detail: { projectId },
        }),
      );

      await loadScenes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao gerar áudio da cena",
      );
    } finally {
      setGeneratingSceneId(null);
    }
  }

  async function handleGenerateAll() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratingAll(true);

    try {
      // Save all edited scripts first
      const dirtyIds = Object.keys(editedScripts);
      if (dirtyIds.length > 0) {
        await Promise.all(
          dirtyIds.map((sceneId) =>
            fetch(`${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}`, {
              body: JSON.stringify({ script: editedScripts[sceneId] }),
              headers: { "Content-Type": "application/json" },
              method: "PATCH",
            }),
          ),
        );
      }

      // Generate all narration audios
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes/audio/generate`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message ?? `HTTP ${response.status}`);
      }

      const body = (await response.json()) as { generatedCount: number };
      setSuccessMessage(
        `Geração completa! ${body.generatedCount} cena(s) processada(s).`,
      );

      // Clear all dirty states
      setEditedScripts({});

      // Notify parent about scene changes
      window.dispatchEvent(
        new CustomEvent("open-video-studio:scenes-updated", {
          detail: { projectId },
        }),
      );

      await loadScenes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao gerar narrações",
      );
    } finally {
      setGeneratingAll(false);
    }
  }

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 text-slate-400">
        <p className="animate-pulse">Carregando narrações do projeto...</p>
      </div>
    );
  }

  const hasDirtyText = Object.keys(editedScripts).length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Audio element for preview */}
      {playingSceneId && audioPreviewUrl ? (
        <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-2xl flex flex-col gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Tocando Narração
          </span>
          <audio
            id="scene-preview-audio"
            ref={audioRef}
            controls
            autoPlay
            src={audioPreviewUrl}
            onEnded={() => setPlayingSceneId(null)}
            className="w-full h-8"
          />
        </div>
      ) : (
        <audio
          ref={audioRef}
          src={audioPreviewUrl ?? ""}
          onEnded={() => setPlayingSceneId(null)}
          className="hidden"
        />
      )}

      {/* Messages */}
      {errorMessage && (
        <div className="voice-status-banner error">{errorMessage}</div>
      )}

      {successMessage && (
        <div id="scene-audio-status" className="voice-status-banner success">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      )}

      {/* Header controls */}
      <div className="flex justify-between items-center bg-slate-950/20 border border-slate-900/60 p-4 rounded-2xl">
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Ações globais
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Gere todos os áudios pendentes ou atualize as falas modificadas de
            uma vez.
          </p>
        </div>

        <button
          id="generate-scene-audio"
          type="button"
          onClick={() => void handleGenerateAll()}
          disabled={generatingAll || scenes.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-violet-500/30 bg-violet-650 hover:bg-violet-650/80 disabled:bg-slate-950/40 disabled:border-slate-800 disabled:text-slate-500 transition-all cursor-pointer animate-fade-in"
        >
          {generatingAll ? (
            <>
              <RefreshCw className="animate-spin" size={15} />
              Processando...
            </>
          ) : (
            <>
              <Mic size={15} />
              {hasDirtyText ? "Salvar e Gerar Tudo" : "Gerar Todos os Áudios"}
            </>
          )}
        </button>
      </div>

      {/* Selected Scene Narration */}
      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
        {selectedScene ? (
          (() => {
            const scene = selectedScene;
            const isDirty = editedScripts[scene.id] !== undefined;
            const currentText = isDirty
              ? editedScripts[scene.id]
              : scene.script;
            const isGenerating = generatingSceneId === scene.id;
            const isPlaying = playingSceneId === scene.id;

            return (
              <div
                key={scene.id}
                className={`audio-card-item ${isDirty ? "dirty" : ""}`}
              >
                {/* Canva-like row styling */}
                <div className="flex items-center gap-3">
                  {/* Circular Play Button */}
                  <button
                    id={`preview-scene-${scene.id}`}
                    type="button"
                    disabled={!scene.hasValidAudio || !scene.audioPath}
                    onClick={() => {
                      if (scene.audioPath) {
                        playAudio(scene.id, scene.audioPath);
                      }
                    }}
                    className={`audio-play-circle-btn ${
                      !scene.hasValidAudio
                        ? "disabled"
                        : isPlaying
                          ? "playing"
                          : "ready"
                    }`}
                    title={
                      scene.hasValidAudio
                        ? "Ouvir narração"
                        : "Áudio indisponível"
                    }
                  >
                    {isPlaying ? (
                      <Pause size={14} fill="currentColor" />
                    ) : (
                      <Play
                        size={14}
                        fill={scene.hasValidAudio ? "currentColor" : "none"}
                        style={{ marginLeft: scene.hasValidAudio ? 2 : 0 }}
                      />
                    )}
                  </button>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <span className="voice-scene-title audio-title-primary">
                      {scene.title}
                    </span>
                    <span
                      className={`audio-subtitle-secondary ${scene.hasValidAudio ? "ready" : ""}`}
                    >
                      {scene.hasValidAudio
                        ? `Áudio • ${scene.audioDurationSeconds}s`
                        : "Sem áudio"}
                    </span>
                  </div>

                  {/* Quick Action Button */}
                  <button
                    type="button"
                    onClick={() => void handleSingleSceneGenerate(scene.id)}
                    disabled={isGenerating || generatingAll}
                    className="flex-shrink-0 p-2 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                    title={
                      isDirty ? "Salvar e gerar narração" : "Regenerar narração"
                    }
                  >
                    {isGenerating ? (
                      <RefreshCw
                        className="animate-spin text-violet-400"
                        size={13}
                      />
                    ) : isDirty ? (
                      <Save size={13} className="text-violet-400" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                  </button>
                </div>

                {/* Text Area Edit Field */}
                <div className="relative">
                  <textarea
                    id="script-editor"
                    aria-busy="false"
                    value={currentText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditedScripts((prev) => ({
                        ...prev,
                        [scene.id]: val,
                      }));
                    }}
                    placeholder="Insira a narração falada desta cena..."
                    className="audio-scene-editor-textarea"
                  />
                  {isDirty && (
                    <span className="absolute bottom-2.5 right-2.5 text-[9px] text-violet-400 bg-violet-950/60 px-1.5 py-0.5 rounded border border-violet-500/20 font-medium">
                      Modificado
                    </span>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="text-xs text-slate-500 text-center py-4 bg-slate-950/20 rounded-xl border border-slate-900">
            Selecione uma cena na timeline para começar
          </div>
        )}
      </div>
    </div>
  );
}
