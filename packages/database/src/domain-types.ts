export const projectStatuses = ["draft", "scripting", "rendering", "ready_for_review", "error"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const sceneStatuses = ["draft", "ready"] as const;
export type SceneStatus = (typeof sceneStatuses)[number];

export const voiceProfileStatuses = ["active", "archived"] as const;
export type VoiceProfileStatus = (typeof voiceProfileStatuses)[number];

export const assetKinds = ["image", "video", "audio"] as const;
export type AssetKind = (typeof assetKinds)[number];

export const assetSources = ["upload", "generated", "external"] as const;
export type AssetSource = (typeof assetSources)[number];

export const assetStatuses = ["ready", "missing"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export const renderJobStatuses = ["queued", "running", "succeeded", "failed"] as const;
export type RenderJobStatus = (typeof renderJobStatuses)[number];
