import { describe, expect, it } from "vitest";

import { validateVoiceSample } from "./validation.js";

function buildWavBuffer(durationSeconds: number) {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

describe("validateVoiceSample", () => {
  it("accepts a valid wav sample with at least 3 seconds", () => {
    const metadata = validateVoiceSample({
      buffer: buildWavBuffer(3.5),
      fileName: "sample.wav",
      mimeType: "audio/wav"
    });

    expect(metadata.mimeType).toBe("audio/wav");
    expect(metadata.durationSeconds).toBe(3.5);
  });

  it("rejects unsupported formats", () => {
    expect(() =>
      validateVoiceSample({
        buffer: Buffer.from("fake"),
        fileName: "sample.mp3",
        mimeType: "audio/mpeg"
      })
    ).toThrow("Formato de áudio inválido. Envie um arquivo WAV");
  });

  it("rejects invalid wav headers", () => {
    expect(() =>
      validateVoiceSample({
        buffer: Buffer.from("not-a-real-wav"),
        fileName: "sample.wav",
        mimeType: "audio/wav"
      })
    ).toThrow("A amostra de voz está vazia ou corrompida");
  });

  it("rejects short voice samples", () => {
    expect(() =>
      validateVoiceSample({
        buffer: buildWavBuffer(2.2),
        fileName: "sample.wav",
        mimeType: "audio/wav"
      })
    ).toThrow("A amostra de voz deve ter pelo menos 3 segundos");
  });
});
