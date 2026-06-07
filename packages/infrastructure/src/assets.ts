export type SuggestedAssetKind = "image" | "video";

export interface SuggestedAsset {
  provider: string;
  externalId: string;
  kind: SuggestedAssetKind;
  url: string;
  previewUrl?: string;
  title?: string;
}

export interface AssetProvider {
  search(keywords: string[]): Promise<SuggestedAsset[]>;
}

export type AssetProviderErrorCode =
  | "PROVIDER_OFFLINE"
  | "PROVIDER_REQUEST_FAILED"
  | "PROVIDER_TIMEOUT";

export class AssetProviderError extends Error {
  readonly code: AssetProviderErrorCode;
  readonly provider: string;
  readonly retriable: boolean;

  constructor(
    message: string,
    options: {
      cause?: unknown;
      code: AssetProviderErrorCode;
      provider: string;
      retriable: boolean;
    },
  ) {
    super(message, { cause: options.cause });
    this.code = options.code;
    this.name = "AssetProviderError";
    this.provider = options.provider;
    this.retriable = options.retriable;
  }
}

export interface MockAsset {
  externalId: string;
  kind: SuggestedAssetKind;
  url: string;
  previewUrl?: string;
  title?: string;
  keywords: string[];
}

export const DEFAULT_MOCK_ASSETS: MockAsset[] = [
  {
    externalId: "mock-image-1",
    kind: "image",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    previewUrl:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=150",
    title: "Montanhas e Lago",
    keywords: ["montanha", "lago", "natureza", "paisagem", "abertura"],
  },
  {
    externalId: "mock-video-1",
    kind: "video",
    url: "https://vjs.zencdn.net/v/oceans.mp4",
    previewUrl:
      "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150",
    title: "Ondas do Oceano",
    keywords: ["oceano", "mar", "agua", "desenvolvimento", "ondas"],
  },
  {
    externalId: "mock-image-2",
    kind: "image",
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
    previewUrl:
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150",
    title: "Floresta no Nevoeiro",
    keywords: ["floresta", "arvores", "nevoeiro", "natureza", "verde"],
  },
  {
    externalId: "mock-video-2",
    kind: "video",
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    previewUrl:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150",
    title: "Coelho da Animação",
    keywords: ["coelho", "animacao", "desenho", "encerramento"],
  },
];

export class MockAssetProvider implements AssetProvider {
  private readonly assets: MockAsset[];
  private readonly providerName = "mock-provider";

  constructor(assets: MockAsset[] = DEFAULT_MOCK_ASSETS) {
    this.assets = assets;
  }

  async search(keywords: string[]): Promise<SuggestedAsset[]> {
    if (keywords.includes("trigger-error")) {
      throw new AssetProviderError("Mock provider simulated request failure", {
        code: "PROVIDER_REQUEST_FAILED",
        provider: this.providerName,
        retriable: false,
      });
    }

    if (keywords.includes("trigger-timeout")) {
      throw new AssetProviderError("Mock provider request timed out", {
        code: "PROVIDER_TIMEOUT",
        provider: this.providerName,
        retriable: true,
      });
    }

    if (keywords.includes("trigger-offline")) {
      throw new AssetProviderError("Mock provider is offline", {
        code: "PROVIDER_OFFLINE",
        provider: this.providerName,
        retriable: true,
      });
    }

    const normalizedKeywords = keywords.map((kw) => kw.toLowerCase().trim());
    if (normalizedKeywords.length === 0) {
      return [];
    }

    const results = this.assets.filter((asset) =>
      asset.keywords.some((kw) =>
        normalizedKeywords.includes(kw.toLowerCase().trim()),
      ),
    );

    return results.map((asset) => ({
      provider: this.providerName,
      externalId: asset.externalId,
      kind: asset.kind,
      url: asset.url,
      previewUrl: asset.previewUrl,
      title: asset.title,
    }));
  }
}
