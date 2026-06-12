import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, Pause, RefreshCw, Volume2, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import useStore from "../store/use-store";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";

interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
  samplePath: string;
  sampleDurationSeconds: number;
}

interface Scene {
  id: string;
  title: string;
  script: string;
  orderIndex: number;
  audioPath?: string | null;
  audioDurationSeconds?: number | null;
  hasValidAudio?: boolean;
}

export const AiVoice = () => {
  const { projectId, voiceProfileId, setVoiceProfileId, trackItemsMap } = useStore();
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // Fetch voice profiles
  useEffect(() => {
    async function loadVoices() {
      setLoadingVoices(true);
      try {
        const res = await fetch(`${apiBaseUrl}/voice-profiles`);
        if (res.ok) {
          const data = await res.json();
          setVoices(data);
        }
      } catch (err) {
        console.error("Error loading voice profiles:", err);
      } finally {
        setLoadingVoices(false);
      }
    }
    loadVoices();
  }, [apiBaseUrl]);

  // Fetch scenes
  const loadScenes = useCallback(async () => {
    if (!projectId) return;
    setLoadingScenes(true);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/scenes`);
      if (res.ok) {
        const data = await res.json();
        setScenes(data.scenes || []);
      }
    } catch (err) {
      console.error("Error loading scenes:", err);
    } finally {
      setLoadingScenes(false);
    }
  }, [projectId, apiBaseUrl]);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  // Handle playing voice preview
  const playVoiceSample = (voice: VoiceProfile) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const fullUrl = `${apiBaseUrl}/${voice.samplePath}`;
    const audio = new Audio(fullUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voice.id);

    audio.play();
    audio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  // Change project voice profile
  const selectVoiceProfile = async (voiceId: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/voice-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceProfileId: voiceId }),
      });
      if (res.ok) {
        setVoiceProfileId(voiceId);
      }
    } catch (err) {
      console.error("Error setting voice profile:", err);
    }
  };

  // Update a scene script text on the API and local State
  const updateSceneScript = async (sceneId: string, newScript: string) => {
    if (!projectId) return;
    setSavingSceneId(sceneId);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: newScript }),
      });

      if (res.ok) {
        // Also update local list
        setScenes((prev) =>
          prev.map((s) => (s.id === sceneId ? { ...s, script: newScript } : s))
        );

        // Update the DesignCombo state (the text element in timeline/canvas!)
        const captionItemId = `caption-${sceneId}`;
        if (trackItemsMap[captionItemId]) {
          dispatch(EDIT_OBJECT, {
            payload: {
              [captionItemId]: {
                details: {
                  text: newScript,
                },
              },
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to update scene script:", err);
    } finally {
      setSavingSceneId(null);
    }
  };

  // Generate TTS Audio for all scenes
  const generateAudios = async () => {
    if (!projectId) return;
    if (!voiceProfileId) {
      alert("Por favor, selecione uma voz primeiro!");
      return;
    }

    setGeneratingAudio(true);
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}/scenes/audio/generate`, {
        method: "POST",
      });

      if (res.ok) {
        await loadScenes();
        alert("Áudios gerados com sucesso!");
        // Refresh the page or reload project mapping to update timeline audio track durations!
        window.location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Falha ao gerar os áudios");
      }
    } catch (err) {
      console.error("Error generating audio:", err);
      alert("Erro ao gerar áudios.");
    } finally {
      setGeneratingAudio(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-card text-foreground">
      <ScrollArea className="flex-1 px-4 py-4 max-h-[calc(100vh-120px)]">
        {/* Section 1: Voice Profiles */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-violet-400" />
            Perfil de Voz do Roteiro
          </h3>
          {loadingVoices ? (
            <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Carregando vozes...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {voices.map((voice) => {
                const isSelected = voice.id === voiceProfileId;
                return (
                  <Card
                    key={voice.id}
                    className={`p-3 flex items-center justify-between transition-all duration-200 border cursor-pointer hover:bg-white/5 ${
                      isSelected
                        ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5"
                        : "border-border/50 bg-black/20"
                    }`}
                    onClick={() => selectVoiceProfile(voice.id)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playVoiceSample(voice);
                        }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          playingVoiceId === voice.id
                            ? "bg-red-500 text-white"
                            : "bg-white/10 hover:bg-violet-600 hover:text-white"
                        }`}
                      >
                        {playingVoiceId === voice.id ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{voice.name}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {voice.provider.replace("-", " ")}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-violet-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Ativa
                      </span>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Scene Narrations / Scripts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Roteiros das Cenas
            </h3>
            <Button
              onClick={generateAudios}
              disabled={generatingAudio}
              className="h-8 bg-violet-600 hover:bg-violet-700 text-white text-[11px] rounded-full font-medium cursor-pointer flex items-center gap-1 px-3.5"
            >
              {generatingAudio ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Regerar todos áudios
            </Button>
          </div>

          {loadingScenes ? (
            <div className="flex items-center gap-2 py-8 justify-center text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              <span>Carregando cenas...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {scenes.map((scene) => (
                <Card key={scene.id} className="p-3 border-border/50 bg-black/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                      Cena {scene.orderIndex + 1}: {scene.title}
                    </span>
                    <span
                      className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                        scene.hasValidAudio
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {scene.hasValidAudio ? "Áudio Pronto" : "Sem Áudio"}
                    </span>
                  </div>

                  <div className="relative">
                    <Textarea
                      defaultValue={scene.script}
                      onBlur={(e) => updateSceneScript(scene.id, e.target.value)}
                      placeholder="Texto da narração desta cena..."
                      className="text-xs min-h-[60px] bg-white/5 border-white/10 resize-none pr-8"
                    />
                    {savingSceneId === scene.id && (
                      <div className="absolute bottom-2 right-2 text-violet-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
