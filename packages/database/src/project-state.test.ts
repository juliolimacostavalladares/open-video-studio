import { describe, expect, it } from "vitest";

import { canEditProject, canPublishProject } from "./project-state.js";

describe("canEditProject", () => {
  it("allows editing draft-like states and blocks review/render states", () => {
    expect(canEditProject("draft")).toBe(true);
    expect(canEditProject("scripting")).toBe(true);
    expect(canEditProject("rejected")).toBe(true);
    expect(canEditProject("error")).toBe(true);
    expect(canEditProject("rendering")).toBe(false);
    expect(canEditProject("ready_for_review")).toBe(false);
    expect(canEditProject("approved")).toBe(false);
  });
});

describe("canPublishProject", () => {
  it("only allows publishing if status is approved", () => {
    expect(canPublishProject("approved")).toBe(true);
    expect(canPublishProject("draft")).toBe(false);
    expect(canPublishProject("scripting")).toBe(false);
    expect(canPublishProject("rendering")).toBe(false);
    expect(canPublishProject("ready_for_review")).toBe(false);
    expect(canPublishProject("rejected")).toBe(false);
    expect(canPublishProject("error")).toBe(false);
  });
});
