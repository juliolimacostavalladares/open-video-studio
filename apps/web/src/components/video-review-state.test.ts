import { describe, expect, it } from "vitest";
import { applyVideoReviewTransition } from "./video-review-state.js";

describe("video review state transitions", () => {
  it("should transition states correctly", () => {
    expect(
      applyVideoReviewTransition("loading", "fetch_success_with_render"),
    ).toBe("ready");
    expect(
      applyVideoReviewTransition("loading", "fetch_success_no_render"),
    ).toBe("no_render");
    expect(applyVideoReviewTransition("loading", "fetch_failed")).toBe("error");
    expect(applyVideoReviewTransition("ready", "reset")).toBe("loading");
  });
});
