export const DEFAULT_FALLBACK_PATH = "assets/fallbacks/default-placeholder.png";

export interface SceneVisualAssetInput {
  assetId?: string | null;
  asset?: {
    id: string;
    kind: string;
    path: string;
    source: string;
    status: string;
  } | null;
}

export function getSceneFallbackAsset(projectId: string) {
  return {
    projectId,
    kind: "image" as const,
    source: "external" as const,
    path: DEFAULT_FALLBACK_PATH,
    status: "ready" as const,
  };
}

export function isFallbackAsset(path: string | null | undefined): boolean {
  return path === DEFAULT_FALLBACK_PATH;
}
