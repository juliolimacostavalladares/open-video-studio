import { ADD_IMAGE, ADD_VIDEO } from "@designcombo/state";
import { dispatch } from "@designcombo/events";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  UploadIcon,
  Trash2,
  Plus,
  Search,
} from "lucide-react";
import { generateId } from "@designcombo/timeline";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useRef, useCallback } from "react";
import useStore from "../store/use-store";
import { Input } from "@/components/ui/input";

interface Asset {
  id: string;
  kind: "image" | "video";
  path: string;
  source: string;
  status: string;
  createdAt: string;
}

export const Uploads = () => {
  const { projectId } = useStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"todos" | "imagens" | "videos">("todos");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchAssets = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/projects/${projectId}/assets`, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, apiBaseUrl]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("asset", file);

    try {
      const response = await fetch(`${apiBaseUrl}/projects/${projectId}/assets`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        await fetchAssets();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.message || "Failed to upload asset");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAsset = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Deseja realmente deletar esta mídia? Ela será removida das cenas que a utilizam.")) return;

    try {
      const response = await fetch(`${apiBaseUrl}/projects/${projectId}/assets/${assetId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const handleAddVideo = (asset: Asset) => {
    const fullUrl = `${apiBaseUrl}/${asset.path}`;
    dispatch(ADD_VIDEO, {
      payload: {
        id: generateId(),
        details: {
          src: fullUrl,
        },
        metadata: {
          previewUrl: "",
          dbAssetId: asset.id,
        },
      },
      options: {
        resourceId: "main",
        scaleMode: "fit",
      },
    });
  };

  const handleAddImage = (asset: Asset) => {
    const fullUrl = `${apiBaseUrl}/${asset.path}`;
    dispatch(ADD_IMAGE, {
      payload: {
        id: generateId(),
        type: "image",
        display: {
          from: 0,
          to: 5000,
        },
        details: {
          src: fullUrl,
        },
        metadata: {
          dbAssetId: asset.id,
        },
      },
      options: {},
    });
  };

  const handleAddAsset = (asset: Asset) => {
    if (asset.kind === "video") {
      handleAddVideo(asset);
    } else {
      handleAddImage(asset);
    }
  };

  // Filter and Search logic
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.path.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterTab === "imagens") {
      return matchesSearch && asset.kind === "image";
    }
    if (filterTab === "videos") {
      return matchesSearch && asset.kind === "video";
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-1 flex-col h-full bg-card text-foreground">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,video/*"
      />

      {/* Upload button */}
      <div className="p-4 flex gap-2 flex-col">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-medium flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-500/10 transition-all duration-200 active:scale-95"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <UploadIcon className="w-5 h-5" />
          )}
          <span>Fazer upload de arquivos</span>
        </Button>
      </div>

      {/* Search Input */}
      <div className="px-4 pb-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar mídias..."
            className="pl-10 h-10 w-full bg-white/5 border-white/10 text-sm rounded-full placeholder-muted-foreground focus-visible:ring-1 focus-visible:ring-violet-500"
          />
        </div>
      </div>

      {/* Tab Filters */}
      <div className="px-4 border-b border-border/50 flex gap-4 text-xs font-semibold">
        {(["todos", "imagens", "videos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`pb-3 capitalize transition-all duration-200 relative cursor-pointer ${
              filterTab === tab ? "text-violet-400 font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {filterTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Grid List */}
      <ScrollArea className="flex-1 px-4 py-4 max-h-[calc(100vh-250px)]">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            <span>Carregando mídias...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/60 text-xs text-center gap-2">
            <ImageIcon className="w-10 h-10 stroke-[1.2] opacity-40" />
            <span>Nenhuma mídia encontrada</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredAssets.map((asset) => {
              const fullUrl = `${apiBaseUrl}/${asset.path}`;
              return (
                <div
                  key={asset.id}
                  onClick={() => handleAddAsset(asset)}
                  className="group relative w-full aspect-square rounded-lg bg-black/40 overflow-hidden cursor-pointer border border-border/40 hover:border-violet-500/50 transition-all duration-200"
                >
                  {/* Media Content */}
                  {asset.kind === "video" ? (
                    <div className="w-full h-full relative">
                      <video
                        src={fullUrl}
                        className="w-full h-full object-cover pointer-events-none"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-mono text-white flex items-center gap-0.5">
                        <VideoIcon className="w-2.5 h-2.5" />
                        <span>VIDEO</span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={fullUrl}
                      alt={asset.path}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  )}

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-1.5 transition-all duration-250">
                    <div className="flex justify-end w-full">
                      <button
                        onClick={(e) => handleDeleteAsset(asset.id, e)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-600/90 text-white hover:bg-red-700 transition-colors"
                        title="Deletar mídia"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex justify-start w-full">
                      <div className="w-6 h-6 flex items-center justify-center rounded-full bg-violet-600 text-white shadow-md">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
