import { describe, expect, it } from "vitest";

import { applyPreviewTransition, applyVoiceSelectionTransition } from "./voice-library-state.js";

describe("voice library state", () => {
  it("transitions selected voice status predictably", () => {
    expect(applyVoiceSelectionTransition("idle", "saveStart")).toBe("saving");
    expect(applyVoiceSelectionTransition("saving", "saveSuccess")).toBe("saved");
    expect(applyVoiceSelectionTransition("saving", "saveError")).toBe("error");
    expect(applyVoiceSelectionTransition("saved", "change")).toBe("idle");
    expect(applyVoiceSelectionTransition("error", "change")).toBe("idle");
  });

  it("tracks preview loading lifecycle", () => {
    expect(applyPreviewTransition("start")).toBe("loading");
    expect(applyPreviewTransition("done")).toBe("ready");
    expect(applyPreviewTransition("error")).toBe("error");
  });
});
