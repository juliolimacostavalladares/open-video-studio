export interface ValidateVoiceSampleInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}

export interface VoiceSampleMetadata {
  durationSeconds: number;
  mimeType: string;
}

const minimumDurationSeconds = 3;
const supportedMimeTypes = new Set(["audio/wav", "audio/wave", "audio/x-wav"]);
const supportedExtensions = new Set([".wav"]);

function findChunk(buffer: Buffer, chunkId: string) {
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const currentChunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (currentChunkId === chunkId) {
      return {
        dataOffset: offset + 8,
        size: chunkSize
      };
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return null;
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function normalizeMimeType(mimeType: string | undefined) {
  if (!mimeType || mimeType === "application/octet-stream") {
    return "audio/wav";
  }

  return mimeType.toLowerCase();
}

function readWavDuration(buffer: Buffer) {
  if (buffer.length < 44) {
    throw new Error("A amostra de voz está vazia ou corrompida");
  }

  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Formato de áudio inválido. Envie um arquivo WAV");
  }

  const formatChunk = findChunk(buffer, "fmt ");
  const dataChunk = findChunk(buffer, "data");

  if (!formatChunk || !dataChunk) {
    throw new Error("Cabeçalho WAV inválido");
  }

  const byteRate = buffer.readUInt32LE(formatChunk.dataOffset + 8);
  if (!byteRate) {
    throw new Error("Cabeçalho WAV inválido");
  }

  return dataChunk.size / byteRate;
}

export function validateVoiceSample(input: ValidateVoiceSampleInput): VoiceSampleMetadata {
  const mimeType = normalizeMimeType(input.mimeType);
  const extension = getFileExtension(input.fileName);

  if (!supportedMimeTypes.has(mimeType) || !supportedExtensions.has(extension)) {
    throw new Error("Formato de áudio inválido. Envie um arquivo WAV");
  }

  const durationSeconds = readWavDuration(input.buffer);
  if (durationSeconds < minimumDurationSeconds) {
    throw new Error("A amostra de voz deve ter pelo menos 3 segundos");
  }

  return {
    durationSeconds: Number(durationSeconds.toFixed(2)),
    mimeType: "audio/wav"
  };
}
