export type VideoRenderStatus =
  | "idle"
  | "queued"
  | "rendering"
  | "success"
  | "error";

export type VideoRenderEvent =
  | "request_start"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "reset";

export function applyVideoRenderTransition(
  current: VideoRenderStatus,
  event: VideoRenderEvent,
): VideoRenderStatus {
  switch (event) {
    case "reset":
      return "idle";
    case "request_start":
      return "queued";
    case "queued":
      return "queued";
    case "running":
      return "rendering";
    case "succeeded":
      return "success";
    case "failed":
      return "error";
    default:
      return current;
  }
}
