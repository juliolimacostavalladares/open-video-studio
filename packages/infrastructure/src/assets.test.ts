import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssetProviderError,
  MockAssetProvider,
  WikimediaCommonsAssetProvider,
  createAssetProvider,
} from "./assets.js";

describe("MockAssetProvider", () => {
  const provider = new MockAssetProvider();

  it("returns assets matching keywords case-insensitively", async () => {
    const results = await provider.search(["OCEANO"]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "mock-provider",
      externalId: "mock-video-1",
      kind: "video",
      title: "Ondas do Oceano",
    });
  });

  it("returns multiple assets when keywords overlap", async () => {
    const results = await provider.search(["natureza"]);
    // Natureza matches mock-image-1 and mock-image-2
    expect(results).toHaveLength(2);
    const ids = results.map((r) => r.externalId);
    expect(ids).toContain("mock-image-1");
    expect(ids).toContain("mock-image-2");
  });

  it("returns empty array when no keywords match", async () => {
    const results = await provider.search(["computador", "teclado"]);
    expect(results).toHaveLength(0);
  });

  it("returns empty array for empty keywords", async () => {
    const results = await provider.search([]);
    expect(results).toHaveLength(0);
  });

  it("simulates provider request failure", async () => {
    await expect(provider.search(["trigger-error"])).rejects.toThrow(
      AssetProviderError,
    );
  });

  it("simulates provider timeout error", async () => {
    await expect(provider.search(["trigger-timeout"])).rejects.toThrow(
      /timed out/i,
    );
  });

  it("simulates provider offline error", async () => {
    await expect(provider.search(["trigger-offline"])).rejects.toThrow(
      /offline/i,
    );
  });
});

describe("WikimediaCommonsAssetProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes Wikimedia Commons API results into suggested assets", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: {
              "123": {
                title: "File:Ocean sunset.jpg",
                imageinfo: [
                  {
                    mime: "image/jpeg",
                    url: "https://upload.wikimedia.org/ocean.jpg",
                    thumburl: "https://upload.wikimedia.org/thumb/ocean.jpg",
                  },
                ],
              },
              "456": {
                title: "File:Ignored audio.ogg",
                imageinfo: [
                  {
                    mime: "audio/ogg",
                    url: "https://upload.wikimedia.org/audio.ogg",
                  },
                ],
              },
            },
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const provider = new WikimediaCommonsAssetProvider({
      fetchImpl: fetchMock,
    });

    const results = await provider.search(["oceano", "por", "do", "sol"]);

    expect(results).toEqual([
      {
        provider: "wikimedia-commons",
        externalId: "File:Ocean sunset.jpg",
        kind: "image",
        previewUrl: "https://upload.wikimedia.org/thumb/ocean.jpg",
        title: "Ocean sunset.jpg",
        url: "https://upload.wikimedia.org/ocean.jpg",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("generator=search");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("gsrnamespace=6");
  });

  it("wraps network failures as provider errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("socket hang up"));
    const provider = new WikimediaCommonsAssetProvider({
      fetchImpl: fetchMock,
    });

    await expect(provider.search(["natureza"])).rejects.toThrow(
      AssetProviderError,
    );
  });
});

describe("createAssetProvider", () => {
  afterEach(() => {
    delete process.env.ASSET_PROVIDER;
    vi.restoreAllMocks();
  });

  it("uses mock provider by default in test environment", () => {
    delete process.env.ASSET_PROVIDER;
    expect(createAssetProvider()).toBeInstanceOf(MockAssetProvider);
  });

  it("uses wikimedia provider when configured explicitly", () => {
    process.env.ASSET_PROVIDER = "wikimedia";
    expect(createAssetProvider()).toBeInstanceOf(WikimediaCommonsAssetProvider);
  });
});
