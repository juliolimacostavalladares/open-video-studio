import { describe, expect, it } from "vitest";
import { validateAsset } from "./validation.js";

describe("validateAsset", () => {
  it("allows valid formats and sizes", () => {
    const pngResult = validateAsset({
      buffer: Buffer.alloc(100),
      fileName: "image.png",
      mimeType: "image/png",
    });
    expect(pngResult).toEqual({
      kind: "image",
      mimeType: "image/png",
    });

    const mp4Result = validateAsset({
      buffer: Buffer.alloc(100),
      fileName: "video.mp4",
      mimeType: "video/mp4",
    });
    expect(mp4Result).toEqual({
      kind: "video",
      mimeType: "video/mp4",
    });
  });

  it("rejects files exceeding max size", () => {
    expect(() =>
      validateAsset({
        buffer: Buffer.alloc(200),
        fileName: "image.png",
        mimeType: "image/png",
        maxSize: 100,
      }),
    ).toThrow(/excede o limite máximo/);
  });

  it("rejects invalid extensions and MIME types", () => {
    expect(() =>
      validateAsset({
        buffer: Buffer.alloc(100),
        fileName: "doc.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrow(/Formato de arquivo inválido/);
  });
});
