import { describe, expect, it } from "vitest";

import {
  buildSceneAudioHash,
  canStartRenderWithSceneAudio,
  sceneHasValidAudio,
  sceneNeedsAudioGeneration
} from "./scene-audio.js";

describe("scene audio helpers", () => {
  it("changes the hash when script or voice changes", () => {
    const base = buildSceneAudioHash({
      script: "Texto base",
      voiceProfileId: "voice-1"
    });

    expect(
      buildSceneAudioHash({
        script: "Texto base alterado",
        voiceProfileId: "voice-1"
      })
    ).not.toBe(base);

    expect(
      buildSceneAudioHash({
        script: "Texto base",
        voiceProfileId: "voice-2"
      })
    ).not.toBe(base);
  });

  it("detects when a scene needs regeneration", () => {
    const audioContentHash = buildSceneAudioHash({
      script: "Cena estável",
      voiceProfileId: "voice-1"
    });

    expect(
      sceneNeedsAudioGeneration({
        script: "Cena estável",
        voiceProfileId: "voice-1",
        currentVoiceProfileId: "voice-1",
        generatedVoiceProfileId: "voice-1",
        audioContentHash,
        audioPath: "audio/scenes/scene-1.wav"
      })
    ).toBe(false);

    expect(
      sceneNeedsAudioGeneration({
        script: "Cena alterada",
        voiceProfileId: "voice-1",
        currentVoiceProfileId: "voice-1",
        generatedVoiceProfileId: "voice-1",
        audioContentHash,
        audioPath: "audio/scenes/scene-1.wav"
      })
    ).toBe(true);

    expect(
      sceneNeedsAudioGeneration({
        script: "Cena estável",
        voiceProfileId: "voice-1",
        currentVoiceProfileId: "voice-2",
        generatedVoiceProfileId: "voice-1",
        audioContentHash,
        audioPath: "audio/scenes/scene-1.wav"
      })
    ).toBe(true);
  });

  it("blocks render when any scene has invalid audio", () => {
    const validHash = buildSceneAudioHash({
      script: "Cena pronta",
      voiceProfileId: "voice-1"
    });

    expect(
      canStartRenderWithSceneAudio(
        [
          {
            script: "Cena pronta",
            voiceProfileId: "voice-1",
            audioContentHash: validHash,
            audioPath: "audio/scenes/scene-1.wav"
          },
          {
            script: "Cena pendente",
            voiceProfileId: "voice-1",
            audioContentHash: null,
            audioPath: null
          }
        ],
        "voice-1"
      )
    ).toBe(false);

    expect(
      sceneHasValidAudio({
        script: "Cena pronta",
        voiceProfileId: "voice-1",
        audioContentHash: validHash,
        audioPath: "audio/scenes/scene-1.wav"
      })
    ).toBe(true);
  });
});
