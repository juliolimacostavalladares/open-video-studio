import type { IDesign, ITrack, ITrackItem } from "@designcombo/types";

export interface ApiScene {
  id: string;
  title: string;
  script: string;
  orderIndex: number;
  status: string;
  audioPath?: string | null;
  audioDurationSeconds?: number | null;
  assetId?: string | null;
  asset?: {
    id: string;
    kind: "image" | "video";
    path: string;
    source: string;
    status: string;
  } | null;
}

export interface ApiProject {
  id: string;
  title: string;
  status: string;
  voiceProfileId: string | null;
  estimatedDuration: number;
}

export function mapProjectScenesToDesign(
  project: ApiProject,
  scenes: ApiScene[],
  apiBaseUrl: string,
): IDesign {
  const fps = 30;
  const size = { width: 1080, height: 1920 };

  const visualItems: string[] = [];
  const audioItems: string[] = [];
  const captionItems: string[] = [];

  const trackItemsMap: Record<string, ITrackItem> = {};

  // Sort scenes by orderIndex to ensure correct sequential layout
  const sortedScenes = [...scenes].sort((a, b) => a.orderIndex - b.orderIndex);

  let cumulativeMs = 0;

  for (const scene of sortedScenes) {
    const durationSeconds = scene.audioDurationSeconds || 3.0;
    const durationMs = Math.ceil(durationSeconds * 1000);

    const startMs = cumulativeMs;
    const endMs = cumulativeMs + durationMs;
    cumulativeMs = endMs;

    const visualItemId = `visual-${scene.id}`;
    const audioItemId = `audio-${scene.id}`;
    const captionItemId = `caption-${scene.id}`;

    // 1. Visual Item (image or video)
    const assetPath =
      scene.asset?.path || "assets/fallbacks/default-placeholder.png";
    const assetKind = scene.asset?.kind || "image";
    const fullAssetUrl = assetPath.startsWith("http")
      ? assetPath
      : `${apiBaseUrl}/${assetPath}`;

    const visualItem: ITrackItem = {
      id: visualItemId,
      name: assetKind,
      type: assetKind,
      metadata: {},
      display: {
        from: startMs,
        to: endMs,
      },
      duration: durationMs,
      trim: {
        from: 0,
        to: durationMs,
      },
      playbackRate: 1,
      isMain: false,
      details: {
        src: fullAssetUrl,
        opacity: 100,
        width: 1080,
        height: 1920,
        top: "960px",
        left: "540px",
        transform: "scale(1)",
        rotate: "0deg",
        visibility: "visible",
        volume: 100,
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "#000000",
        boxShadow: {
          color: "#000000",
          x: 0,
          y: 0,
          blur: 0,
        },
      } as any,
    };
    trackItemsMap[visualItemId] = visualItem;
    visualItems.push(visualItemId);

    // 2. Audio Narration Item
    if (scene.audioPath) {
      const fullAudioUrl = scene.audioPath.startsWith("http")
        ? scene.audioPath
        : `${apiBaseUrl}/${scene.audioPath}`;
      const audioItem: ITrackItem = {
        id: audioItemId,
        name: "audio",
        type: "audio",
        metadata: {},
        display: {
          from: startMs,
          to: endMs,
        },
        duration: durationMs,
        trim: {
          from: 0,
          to: durationMs,
        },
        playbackRate: 1,
        isMain: false,
        details: {
          src: fullAudioUrl,
          volume: 100,
        } as any,
      };
      trackItemsMap[audioItemId] = audioItem;
      audioItems.push(audioItemId);
    }

    // 3. Subtitle / Caption Item
    const captionItem: ITrackItem = {
      id: captionItemId,
      name: "caption",
      type: "caption",
      metadata: {
        sourceUrl: scene.audioPath
          ? scene.audioPath.startsWith("http")
            ? scene.audioPath
            : `${apiBaseUrl}/${scene.audioPath}`
          : undefined,
        parentId: visualItemId,
      },
      display: {
        from: startMs,
        to: endMs,
      },
      duration: durationMs,
      trim: {
        from: 0,
        to: durationMs,
      },
      playbackRate: 1,
      isMain: false,
      details: {
        text: scene.script,
        fontSize: 44,
        fontFamily: "Inter",
        fontUrl: "",
        textAlign: "center",
        color: "#ffffff",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        borderColor: "#000000",
        borderWidth: 0,
        top: "1400px",
        left: "140px",
        width: 800,
        height: 150,
        opacity: 100,
        fontWeight: "bold",
        textShadow: "0px 2px 8px rgba(0,0,0,0.8)",
        borderRadius: 16,
      } as any,
    };
    trackItemsMap[captionItemId] = captionItem;
    captionItems.push(captionItemId);
  }

  const tracks: ITrack[] = [
    {
      id: "track-captions",
      type: "caption",
      items: captionItems,
      accepts: ["caption"],
      magnetic: false,
      static: false,
      muted: false,
    },
    {
      id: "track-visuals",
      type: "video",
      items: visualItems,
      accepts: ["video", "image"],
      magnetic: false,
      static: false,
      muted: false,
    },
  ];

  if (audioItems.length > 0) {
    tracks.push({
      id: "track-audio",
      type: "audio",
      items: audioItems,
      accepts: ["audio"],
      magnetic: false,
      static: false,
      muted: false,
    });
  }

  return {
    id: project.id,
    fps,
    size,
    tracks,
    trackItemIds: [...captionItems, ...visualItems, ...audioItems],
    transitionIds: [],
    transitionsMap: {},
    trackItemsMap,
  };
}
