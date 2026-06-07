import { describe, expect, it } from "vitest";
import { MockAssetProvider, AssetProviderError } from "./assets.js";

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
