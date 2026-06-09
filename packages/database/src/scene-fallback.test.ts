import { describe, expect, it } from "vitest";
import {
  getSceneFallbackAsset,
  isFallbackAsset,
  DEFAULT_FALLBACK_PATH,
} from "./scene-fallback.js";

describe("scene-fallback unit rules", () => {
  it("generates correct fallback asset structure", () => {
    const fallback = getSceneFallbackAsset("test-project-id");
    expect(fallback).toEqual({
      projectId: "test-project-id",
      kind: "image",
      source: "external",
      path: DEFAULT_FALLBACK_PATH,
      status: "ready",
    });
  });

  it("identifies fallback asset paths correctly", () => {
    expect(isFallbackAsset(DEFAULT_FALLBACK_PATH)).toBe(true);
    expect(isFallbackAsset("assets/manual/other.png")).toBe(false);
    expect(isFallbackAsset(null)).toBe(false);
    expect(isFallbackAsset(undefined)).toBe(false);
  });
});
