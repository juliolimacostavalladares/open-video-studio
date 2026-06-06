import { createHash } from "node:crypto";

export const sceneAudioHashVersion = "v1";

export interface SceneAudioHashInput {
  script: string;
  voiceProfileId: string | null;
}

export interface SceneAudioState extends SceneAudioHashInput {
  audioContentHash?: string | null;
  audioPath?: string | null;
}

function normalizeScript(script: string) {
  return script.trim();
}

export function buildSceneAudioHash(input: SceneAudioHashInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        script: normalizeScript(input.script),
        version: sceneAudioHashVersion,
        voiceProfileId: input.voiceProfileId
      })
    )
    .digest("hex");
}

export function sceneHasValidAudio(scene: SceneAudioState) {
  if (!scene.voiceProfileId || !normalizeScript(scene.script) || !scene.audioContentHash || !scene.audioPath) {
    return false;
  }

  return scene.audioContentHash === buildSceneAudioHash({
    script: scene.script,
    voiceProfileId: scene.voiceProfileId
  });
}

export function sceneNeedsAudioGeneration(scene: SceneAudioHashInput & {
  audioContentHash?: string | null;
  audioPath?: string | null;
  currentVoiceProfileId: string | null;
  generatedVoiceProfileId?: string | null;
}) {
  if (!scene.currentVoiceProfileId || !normalizeScript(scene.script)) {
    return false;
  }

  if (!scene.audioPath || !scene.audioContentHash || scene.generatedVoiceProfileId !== scene.currentVoiceProfileId) {
    return true;
  }

  return scene.audioContentHash !== buildSceneAudioHash({
    script: scene.script,
    voiceProfileId: scene.currentVoiceProfileId
  });
}

export function canStartRenderWithSceneAudio(
  scenes: Array<SceneAudioState>,
  selectedVoiceProfileId: string | null
) {
  if (!selectedVoiceProfileId || scenes.length === 0) {
    return false;
  }

  return scenes.every((scene) =>
    sceneHasValidAudio({
      ...scene,
      voiceProfileId: selectedVoiceProfileId
    })
  );
}
