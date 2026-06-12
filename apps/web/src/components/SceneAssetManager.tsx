"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Upload,
  Trash2,
  CheckCircle2,
  Plus,
  Play,
  X,
  Sparkles,
  Search,
} from "lucide-react";

interface Asset {
  id: string;
  kind: "image" | "video";
  path: string;
  source: string;
  status: string;
  createdAt: string;
}

interface Scene {
  id: string;
  title: string;
  script: string;
  keywords: string[];
  assetId?: string | null;
  asset?: Asset | null;
}

interface SceneAssetManagerProps {
  apiBaseUrl: string;
  projectId: string;
  selectedSceneId: string | null;
}

export function SceneAssetManager({
  apiBaseUrl,
  projectId,
  selectedSceneId,
}: SceneAssetManagerProps) {
  const [mounted, setMounted] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);
  const [selectedAssetForMenu, setSelectedAssetForMenu] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "todos" | "imagens" | "videos"
  >("todos");

  const fileInputRef = useRef<HTMLInputElement>(null);

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
          throw new Error(`HTTP ${response.status}`);
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

  const loadAssets = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/projects/${projectId}/assets`,
          {
            cache: "no-store",
            signal,
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const body = (await response.json()) as { assets: Asset[] };
        setAssets(body.assets);
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
    await Promise.all([loadScenes(), loadAssets()]);
    setIsLoading(false);
  }, [loadScenes, loadAssets]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    void hydrate();

    // Listen for external scenes update events (e.g. from timeline drag-drop)
    const handleExternalUpdate = () => {
      void hydrate();
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
  }, [hydrate, mounted]);

  async function handleFileUpload(file: File) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("asset", file);

      const url = selectedSceneId
        ? `${apiBaseUrl}/projects/${projectId}/scenes/${selectedSceneId}/asset`
        : `${apiBaseUrl}/projects/${projectId}/assets`;

      const response = await fetch(url, {
        body: formData,
        method: "POST",
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message ?? `HTTP ${response.status}`);
      }

      setSuccessMessage(
        selectedSceneId
          ? "Mídia enviada e associada com sucesso!"
          : "Mídia enviada com sucesso!",
      );

      // Notify parent/timeline about scene changes
      window.dispatchEvent(
        new CustomEvent("open-video-studio:scenes-updated", {
          detail: { projectId },
        }),
      );

      await Promise.all([loadAssets(), loadScenes()]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao enviar arquivo",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAssociateAsset(sceneId: string, assetId: string | null) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}/asset`,
        {
          body: JSON.stringify({ assetId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message ?? `HTTP ${response.status}`);
      }

      setSuccessMessage(
        assetId
          ? "Mídia associada com sucesso!"
          : "Mídia removida com sucesso!",
      );

      // Notify parent/timeline about scene changes
      window.dispatchEvent(
        new CustomEvent("open-video-studio:scenes-updated", {
          detail: { projectId },
        }),
      );

      await loadScenes();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao associar mídia",
      );
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta mídia do seu projeto? Ela será removida de qualquer cena onde estiver aplicada.",
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/projects/${projectId}/assets/${assetId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message ?? `HTTP ${response.status}`);
      }

      setSuccessMessage("Mídia excluída com sucesso!");

      // Notify parent/timeline about scene changes
      window.dispatchEvent(
        new CustomEvent("open-video-studio:scenes-updated", {
          detail: { projectId },
        }),
      );

      await Promise.all([loadAssets(), loadScenes()]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Erro ao excluir mídia",
      );
    }
  }

  // Drag & drop files on upload zone
  const onDragOverUpload = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverUpload(true);
  };

  const onDragLeaveUpload = () => {
    setIsDragOverUpload(false);
  };

  const onDropUpload = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverUpload(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 text-slate-400">
        <p className="animate-pulse">Carregando biblioteca de mídias...</p>
      </div>
    );
  }

  const filteredAssets = assets.filter((asset) => {
    const filename = asset.path.split("/").pop() || "";
    const matchesSearch = filename
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (activeFilter === "imagens")
      return asset.kind === "image" && matchesSearch;
    if (activeFilter === "videos")
      return asset.kind === "video" && matchesSearch;
    return matchesSearch;
  });

  return (
    <div
      onDragOver={onDragOverUpload}
      onDragLeave={onDragLeaveUpload}
      onDrop={onDropUpload}
      className="flex flex-col gap-6 relative"
    >
      {/* File Upload drag-and-drop visual overlay */}
      {isDragOverUpload && (
        <div className="drawer-drop-overlay">
          <Upload size={32} className="text-white animate-bounce mb-2" />
          <p className="text-xs font-semibold text-white">
            Solte os arquivos para upload
          </p>
        </div>
      )}

      {/* Messages */}
      {errorMessage && (
        <div className="voice-status-banner error">{errorMessage}</div>
      )}

      {successMessage && (
        <div className="voice-status-banner success">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      )}

      {/* Canva-like Search Input */}
      <div className="media-search-container">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search size={15} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Busque palavras-chave, etiquetas, cor"
          className="media-search-input"
        />
      </div>

      {/* Canva-like Large buttons */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="upload-btn-purple"
        >
          <Upload size={14} className={isUploading ? "animate-bounce" : ""} />
          {isUploading ? "Enviando arquivo..." : "Fazer upload de arquivos"}
        </button>
        <button
          type="button"
          onClick={() =>
            alert("Gravação de voz/mídia estará disponível em breve!")
          }
          className="record-btn-outline"
        >
          Gravar agora
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.jpg,.jpeg,.png"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileUpload(file);
          }}
          style={{ display: "none" }}
        />
      </div>

      {/* Canva-like active tab border outline */}
      <div className="media-filter-tabs">
        <button
          type="button"
          onClick={() => setActiveFilter("todos")}
          className={`media-filter-tab ${activeFilter === "todos" ? "active" : ""}`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("imagens")}
          className={`media-filter-tab ${activeFilter === "imagens" ? "active" : ""}`}
        >
          Imagens
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("videos")}
          className={`media-filter-tab ${activeFilter === "videos" ? "active" : ""}`}
        >
          Vídeos
        </button>
      </div>

      {/* Media Bin / Library Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles size={13} />
          Mídias Importadas ({filteredAssets.length})
        </h3>

        {filteredAssets.length === 0 ? (
          <div className="rounded-xl border border-slate-900/60 p-8 text-center text-slate-500 bg-slate-950/5 text-sm">
            Nenhum arquivo encontrado. Importe mídias acima para começar.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
            {filteredAssets.map((asset) => {
              const url = `${apiBaseUrl}/${asset.path}`;
              const isUsed = scenes.some((s) => s.assetId === asset.id);

              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedAssetId(asset.id);
                    e.dataTransfer.setData("text/plain", asset.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDraggedAssetId(null)}
                  onClick={() => {
                    if (selectedSceneId) {
                      void handleAssociateAsset(selectedSceneId, asset.id);
                    } else {
                      setErrorMessage(
                        "Selecione uma cena na timeline primeiro para associar esta mídia.",
                      );
                    }
                  }}
                  className={`group relative rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden cursor-pointer hover:border-violet-500/50 hover:shadow-lg transition-all duration-200 ${
                    draggedAssetId === asset.id ? "opacity-40" : ""
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video w-full bg-slate-900 flex items-center justify-center relative">
                    {asset.kind === "video" ? (
                      <>
                        <video
                          src={url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                        <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                          <Play size={16} className="text-white drop-shadow" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {isUsed && (
                      <span className="absolute top-1.5 right-1.5 bg-violet-600/90 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-violet-500/30">
                        Em uso
                      </span>
                    )}

                    {/* Delete/Apply action overlay */}
                    <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-2">
                      <button
                        title="Excluir do projeto"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteAsset(asset.id);
                        }}
                        className="p-1.5 rounded-lg bg-red-650 hover:bg-red-650/80 text-white transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        title="Aplicar na cena..."
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAssetForMenu(
                            selectedAssetForMenu === asset.id ? null : asset.id,
                          );
                        }}
                        className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown Menu for Apply to Scene */}
                  {selectedAssetForMenu === asset.id && (
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-950/95 p-2 flex flex-col z-20 overflow-y-auto">
                      <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">
                          Aplicar na cena:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAssetForMenu(null)}
                          className="text-slate-500 hover:text-white"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        {scenes.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              void handleAssociateAsset(s.id, asset.id);
                              setSelectedAssetForMenu(null);
                            }}
                            className="text-left text-[11px] py-1 px-1.5 rounded hover:bg-violet-950/50 hover:text-violet-300 text-slate-300 truncate font-medium w-full cursor-pointer"
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filename Footer */}
                  <div className="p-2 border-t border-slate-900/60 bg-slate-950/20">
                    <p className="text-[10px] text-slate-300 truncate font-mono">
                      {asset.path.split("/").pop()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
