import { describe, expect, it } from "vitest";
import { calculateScenesTiming } from "./VerticalVideo";
import type { VideoScene } from "./types";

describe("calculateScenesTiming", () => {
  it("calculates sequential timing correctly with standard audio duration", () => {
    const scenes: VideoScene[] = [
      {
        id: "1",
        orderIndex: 0,
        script: "Scene one text",
        audioPath: "audio/1.wav",
        audioDurationSeconds: 2.5,
        assetPath: null,
        assetKind: null,
      },
      {
        id: "2",
        orderIndex: 1,
        script: "Scene two text",
        audioPath: "audio/2.wav",
        audioDurationSeconds: 4.2,
        assetPath: null,
        assetKind: null,
      },
    ];

    const fps = 30;
    const result = calculateScenesTiming(scenes, fps);

    expect(result).toHaveLength(2);

    // Scene 1: from 0, duration ceil(2.5 * 30) = 75 frames
    expect(result[0]?.startFrame).toBe(0);
    expect(result[0]?.durationFrames).toBe(75);

    // Scene 2: from 75, duration ceil(4.2 * 30) = 126 frames
    expect(result[1]?.startFrame).toBe(75);
    expect(result[1]?.durationFrames).toBe(126);
  });

  it("uses fallback duration of 3 seconds if audio duration is null", () => {
    const scenes: VideoScene[] = [
      {
        id: "1",
        orderIndex: 0,
        script: "Scene one text",
        audioPath: null,
        audioDurationSeconds: null,
        assetPath: null,
        assetKind: null,
      },
    ];

    const fps = 30;
    const result = calculateScenesTiming(scenes, fps);

    expect(result[0]?.startFrame).toBe(0);
    expect(result[0]?.durationFrames).toBe(90); // 3 seconds * 30 fps = 90 frames
  });
});
