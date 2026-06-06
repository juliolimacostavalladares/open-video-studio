export type VoiceSelectionStatus = "error" | "idle" | "saved" | "saving";
export type PreviewStatus = "error" | "idle" | "loading" | "ready";

export function applyVoiceSelectionTransition(
  current: VoiceSelectionStatus,
  event: "change" | "saveError" | "saveStart" | "saveSuccess"
) {
  if (event === "saveStart") {
    return "saving" satisfies VoiceSelectionStatus;
  }

  if (event === "saveSuccess") {
    return "saved" satisfies VoiceSelectionStatus;
  }

  if (event === "saveError") {
    return "error" satisfies VoiceSelectionStatus;
  }

  if (event === "change" && (current === "saved" || current === "error")) {
    return "idle" satisfies VoiceSelectionStatus;
  }

  return current;
}

export function applyPreviewTransition(event: "done" | "error" | "start") {
  if (event === "start") {
    return "loading" satisfies PreviewStatus;
  }

  if (event === "done") {
    return "ready" satisfies PreviewStatus;
  }

  return "error" satisfies PreviewStatus;
}
