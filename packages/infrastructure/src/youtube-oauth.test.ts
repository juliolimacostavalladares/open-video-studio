import { describe, expect, it } from "vitest";
import { YoutubeOAuthService } from "./youtube-oauth.js";

describe("YoutubeOAuthService", () => {
  it("generates mock auth URL in mock mode", () => {
    const service = new YoutubeOAuthService(true);
    const url = service.getAuthUrl("project_123");
    expect(url).toContain("mock_code");
    expect(url).toContain("state=project_123");
  });

  it("exchanges mock code for mock tokens", async () => {
    const service = new YoutubeOAuthService(true);
    const tokens = await service.exchangeCodeForTokens("mock_code");
    expect(tokens.accessToken).toBe("mock_access_token");
    expect(tokens.refreshToken).toBe("mock_refresh_token");
    expect(tokens.expiryDate.getTime()).toBeGreaterThan(Date.now());
  });

  it("refreshes mock tokens", async () => {
    const service = new YoutubeOAuthService(true);
    const tokens = await service.refreshTokens("mock_refresh_token");
    expect(tokens.accessToken).toContain("mock_access_token_refreshed_");
    expect(tokens.expiryDate.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns mock channel details", async () => {
    const service = new YoutubeOAuthService(true);
    const details = await service.getChannelDetails("mock_access_token");
    expect(details.channelId).toBe("UC_MOCK_CHANNEL_ID_12345");
    expect(details.title).toBe("Mock Channel Solo Operator");
    expect(details.thumbnailUrl).toBe(
      "https://placehold.co/100x100?text=MockChannel",
    );
  });
});
