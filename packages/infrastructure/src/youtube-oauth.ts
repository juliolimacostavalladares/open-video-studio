export interface YoutubeTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: Date;
}

export interface YoutubeChannelDetails {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
}

export class YoutubeOAuthService {
  private clientId = process.env.YOUTUBE_CLIENT_ID ?? "";
  private clientSecret = process.env.YOUTUBE_CLIENT_SECRET ?? "";
  private redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ??
    "http://localhost:4000/youtube/callback";
  private isMockMode = process.env.YOUTUBE_MOCK_MODE === "true";

  constructor(forceMock = false) {
    if (forceMock) {
      this.isMockMode = true;
    }
  }

  private assertConfigured(): void {
    if (this.isMockMode) {
      return;
    }
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are required",
      );
    }
  }

  getAuthUrl(state: string): string {
    if (this.isMockMode) {
      const params = new URLSearchParams({
        code: "mock_code",
        state,
      });
      return `${this.redirectUri}?${params.toString()}`;
    }
    this.assertConfigured();

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope:
        "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<YoutubeTokens> {
    if (this.isMockMode || code === "mock_code") {
      return {
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        expiryDate: new Date(Date.now() + 3600 * 1000), // 1 hour
      };
    }
    this.assertConfigured();

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `Failed to exchange code for tokens: ${res.statusText} - ${errBody}`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiryDate: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshTokens(refreshToken: string): Promise<YoutubeTokens> {
    if (this.isMockMode || refreshToken === "mock_refresh_token") {
      return {
        accessToken: "mock_access_token_refreshed_" + Date.now(),
        expiryDate: new Date(Date.now() + 3600 * 1000),
      };
    }
    this.assertConfigured();

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `Failed to refresh token: ${res.statusText} - ${errBody}`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      expiryDate: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getChannelDetails(accessToken: string): Promise<YoutubeChannelDetails> {
    if (this.isMockMode || accessToken.startsWith("mock_access_token")) {
      return {
        channelId: "UC_MOCK_CHANNEL_ID_12345",
        title: "Mock Channel Solo Operator",
        thumbnailUrl: "https://placehold.co/100x100?text=MockChannel",
      };
    }

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `Failed to fetch channel details: ${res.statusText} - ${errBody}`,
      );
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet?: {
          title: string;
          thumbnails?: {
            default?: { url: string };
          };
        };
      }>;
    };

    const item = data.items?.[0];
    if (!item) {
      throw new Error("No YouTube channel found for this account.");
    }

    return {
      channelId: item.id,
      title: item.snippet?.title ?? "Unknown Channel",
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
    };
  }
}
