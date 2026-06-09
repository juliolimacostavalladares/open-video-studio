import { describe, expect, it } from "vitest";
import { applyVideoRenderTransition } from "./video-render-state.js";

describe("video render state machine", () => {
  it("transitions states correctly on events", () => {
    expect(applyVideoRenderTransition("idle", "request_start")).toBe("queued");
    expect(applyVideoRenderTransition("queued", "running")).toBe("rendering");
    expect(applyVideoRenderTransition("rendering", "succeeded")).toBe(
      "success",
    );
    expect(applyVideoRenderTransition("rendering", "failed")).toBe("error");
    expect(applyVideoRenderTransition("success", "reset")).toBe("idle");
    expect(applyVideoRenderTransition("error", "reset")).toBe("idle");
  });
});
