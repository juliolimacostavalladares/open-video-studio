import { describe, expect, it } from "vitest";

import { buildStorageObjectKey } from "./storage.js";

describe("buildStorageObjectKey", () => {
  it("prefixes the namespace and normalizes the key", () => {
    expect(buildStorageObjectKey("audio", "/clips/intro.wav")).toBe("audio/clips/intro.wav");
  });

  it("rejects traversal segments", () => {
    expect(() => buildStorageObjectKey("assets", "../escape.png")).toThrow("Invalid storage key");
  });
});
