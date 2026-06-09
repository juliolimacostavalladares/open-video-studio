export type VideoReviewStatus = "loading" | "no_render" | "ready" | "error";

export type VideoReviewEvent =
  | "fetch_success_with_render"
  | "fetch_success_no_render"
  | "fetch_failed"
  | "reset";

export function applyVideoReviewTransition(
  current: VideoReviewStatus,
  event: VideoReviewEvent,
): VideoReviewStatus {
  switch (event) {
    case "reset":
      return "loading";
    case "fetch_success_with_render":
      return "ready";
    case "fetch_success_no_render":
      return "no_render";
    case "fetch_failed":
      return "error";
    default:
      return current;
  }
}
