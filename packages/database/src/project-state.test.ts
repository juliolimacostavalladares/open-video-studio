import { describe, expect, it } from "vitest";

import { canEditProject } from "./project-state.js";

describe("canEditProject", () => {
  it("allows editing draft-like states and blocks review/render states", () => {
    expect(canEditProject("draft")).toBe(true);
    expect(canEditProject("scripting")).toBe(true);
    expect(canEditProject("error")).toBe(true);
    expect(canEditProject("rendering")).toBe(false);
    expect(canEditProject("ready_for_review")).toBe(false);
  });
});
