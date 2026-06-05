import { describe, expect, it } from "vitest";

import { loadWorkspaceConfig } from "./index.js";

describe("loadWorkspaceConfig", () => {
  it("loads the shared workspace configuration without error", () => {
    expect(() =>
      loadWorkspaceConfig({
        API_PORT: "4100",
        APP_NAME: "Open Video Studio",
        WEB_PORT: "3100"
      })
    ).not.toThrow();
  });
});
