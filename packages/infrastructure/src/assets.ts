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

export interface AssetProviderFactoryOptions {
  fetchImpl?: typeof fetch;
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

interface WikimediaQueryPage {
  title?: string;
  imageinfo?: Array<{
    mime?: string;
    url?: string;
    thumburl?: string;
  }>;
}

interface WikimediaQueryResponse {
  query?: {
    pages?: Record<string, WikimediaQueryPage>;
  };
}

export class WikimediaCommonsAssetProvider implements AssetProvider {
  private readonly providerName = "wikimedia-commons";
  private readonly fetchImpl: typeof fetch;
  private readonly apiUrl = "https://commons.wikimedia.org/w/api.php";
  private readonly requestTimeoutMs: number;
  private readonly resultLimit: number;
  private readonly userAgent: string;

  constructor(
    options: {
      fetchImpl?: typeof fetch;
      requestTimeoutMs?: number;
      resultLimit?: number;
      userAgent?: string;
    } = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8000;
    this.resultLimit = options.resultLimit ?? 6;
    this.userAgent =
      options.userAgent ??
      process.env.ASSET_PROVIDER_USER_AGENT ??
      "OpenVideoStudio/0.1 (asset search)";
  }

  async search(keywords: string[]): Promise<SuggestedAsset[]> {
    const normalizedKeywords = keywords
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);

    if (normalizedKeywords.length === 0) {
      return [];
    }

    const searchQuery = normalizedKeywords.slice(0, 5).join(" ");
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrnamespace: "6",
      gsrlimit: this.resultLimit.toString(),
      gsrsearch: searchQuery,
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "480",
    });

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.apiUrl}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      throw new AssetProviderError(
        isTimeout
          ? "Wikimedia Commons request timed out"
          : "Wikimedia Commons request failed",
        {
          cause: error,
          code: isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_OFFLINE",
          provider: this.providerName,
          retriable: true,
        },
      );
    }

    if (!res.ok) {
      throw new AssetProviderError(
        `Wikimedia Commons returned ${res.status} ${res.statusText}`,
        {
          code: "PROVIDER_REQUEST_FAILED",
          provider: this.providerName,
          retriable: res.status >= 500,
        },
      );
    }

    const payload = (await res.json()) as WikimediaQueryResponse;
    const pages = Object.values(payload.query?.pages ?? {});

    return pages
      .flatMap((page) => {
        const imageInfo = page.imageinfo?.[0];
        if (!imageInfo?.url || !imageInfo.mime) {
          return [];
        }

        const kind = this.mimeToSuggestedKind(imageInfo.mime);
        if (!kind) {
          return [];
        }

        return [
          {
            provider: this.providerName,
            externalId: page.title ?? imageInfo.url,
            kind,
            url: imageInfo.url,
            previewUrl: imageInfo.thumburl ?? imageInfo.url,
            title: page.title?.replace(/^File:/, "") ?? "Wikimedia asset",
          } satisfies SuggestedAsset,
        ];
      })
      .slice(0, this.resultLimit);
  }

  private mimeToSuggestedKind(mimeType: string): SuggestedAssetKind | null {
    if (mimeType.startsWith("image/")) {
      return "image";
    }

    if (mimeType.startsWith("video/")) {
      return "video";
    }

    return null;
  }
}

export function createAssetProvider(
  options: AssetProviderFactoryOptions = {},
): AssetProvider {
  const defaultProvider =
    process.env.NODE_ENV === "test" || process.env.VITEST
      ? "mock"
      : "wikimedia";
  const provider = process.env.ASSET_PROVIDER ?? defaultProvider;

  if (provider === "wikimedia") {
    return new WikimediaCommonsAssetProvider({
      fetchImpl: options.fetchImpl,
    });
  }

  if (provider === "mock") {
    return new MockAssetProvider();
  }

  throw new Error(
    `Unsupported asset provider "${provider}". Expected "wikimedia" or "mock".`,
  );
}
