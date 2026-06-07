import { extname } from "node:path";

export interface ValidateAssetInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  maxSize?: number; // in bytes
}

export interface AssetMetadata {
  mimeType: string;
  kind: "image" | "video";
}

const supportedExtensions = new Set([".mp4", ".mov", ".jpg", ".jpeg", ".png"]);
const supportedMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
]);

export function validateAsset(input: ValidateAssetInput): AssetMetadata {
  const maxSize = input.maxSize ?? 50 * 1024 * 1024; // Default 50MB

  if (input.buffer.length > maxSize) {
    throw new Error(
      `O arquivo excede o limite máximo de ${maxSize / (1024 * 1024)}MB`,
    );
  }

  const ext = extname(input.fileName).toLowerCase();
  const mimeType = input.mimeType?.toLowerCase() || "";

  const isValidExtension = supportedExtensions.has(ext);
  const isValidMimeType = supportedMimeTypes.has(mimeType);

  if (!isValidExtension && !isValidMimeType) {
    throw new Error(
      "Formato de arquivo inválido. Envie um arquivo MP4, MOV, JPG ou PNG",
    );
  }

  let kind: "image" | "video" = "image";
  let resolvedMimeType = mimeType;

  if (ext === ".mp4" || mimeType === "video/mp4") {
    kind = "video";
    resolvedMimeType = "video/mp4";
  } else if (ext === ".mov" || mimeType === "video/quicktime") {
    kind = "video";
    resolvedMimeType = "video/quicktime";
  } else if (ext === ".jpg" || ext === ".jpeg" || mimeType === "image/jpeg") {
    kind = "image";
    resolvedMimeType = "image/jpeg";
  } else if (ext === ".png" || mimeType === "image/png") {
    kind = "image";
    resolvedMimeType = "image/png";
  }

  return {
    kind,
    mimeType: resolvedMimeType,
  };
}
