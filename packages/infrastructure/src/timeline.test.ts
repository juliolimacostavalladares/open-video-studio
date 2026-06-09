import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildVideoTimeline } from "./timeline.js";
import { prisma, sceneHasValidAudio } from "@repo/database";

vi.mock("@repo/database", async (importOriginal) => {
  const original = await importOriginal<typeof import("@repo/database")>();
  return {
    ...original,
    prisma: {
      project: {
        findUnique: vi.fn(),
      },
    },
    sceneHasValidAudio: vi.fn(),
  };
});

describe("buildVideoTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if project not found", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
    await expect(
      buildVideoTimeline("non-existent", "http://api.url"),
    ).rejects.toThrow("Project non-existent not found");
  });

  it("throws error if project has no scenes", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      voiceProfileId: "voice-1",
      scenes: [],
    } as unknown as never);

    await expect(
      buildVideoTimeline("project-1", "http://api.url"),
    ).rejects.toThrow("Project has no scenes to render");
  });

  it("throws error if any scene has invalid audio", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      voiceProfileId: "voice-1",
      scenes: [
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Cena 1",
          audioPath: null,
          audioDurationSeconds: null,
          asset: null,
        },
      ],
    } as unknown as never);

    vi.mocked(sceneHasValidAudio).mockReturnValue(false);

    await expect(
      buildVideoTimeline("project-1", "http://api.url"),
    ).rejects.toThrow("Scene orderIndex 0 does not have valid audio generated");
  });

  it("successfully builds the timeline with resolved URLs and correct order index", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      voiceProfileId: "voice-1",
      scenes: [
        {
          id: "scene-2",
          orderIndex: 1,
          script: "Cena 2",
          audioPath: "audio/scenes/s2.wav",
          audioDurationSeconds: 2.5,
          asset: {
            kind: "video",
            path: "assets/manual/v2.mp4",
          },
        },
        {
          id: "scene-1",
          orderIndex: 0,
          script: "Cena 1",
          audioPath: "audio/scenes/s1.wav",
          audioDurationSeconds: 1.5,
          asset: {
            kind: "image",
            path: "http://external.url/img.jpg",
          },
        },
      ],
    } as unknown as never);

    vi.mocked(sceneHasValidAudio).mockReturnValue(true);

    const timeline = await buildVideoTimeline("project-1", "http://api.url");

    expect(timeline.scenes).toBeDefined();
    const scenes = timeline.scenes!;
    expect(scenes).toHaveLength(2);

    const s1 = scenes[0]!;
    const s2 = scenes[1]!;

    // Check order (should be sorted by orderIndex)
    expect(s1.id).toBe("scene-1");
    expect(s1.audioPath).toBe("http://api.url/audio/scenes/s1.wav");
    expect(s1.assetPath).toBe("http://external.url/img.jpg");
    expect(s1.assetKind).toBe("image");

    expect(s2.id).toBe("scene-2");
    expect(s2.audioPath).toBe("http://api.url/audio/scenes/s2.wav");
    expect(s2.assetPath).toBe("http://api.url/assets/manual/v2.mp4");
    expect(s2.assetKind).toBe("video");
  });
});
