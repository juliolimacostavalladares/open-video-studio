import multipart from "@fastify/multipart";
import Fastify from "fastify";

import { audioPreviewRoutes } from "./routes/audio-preview.js";
import { scriptEditorRoutes } from "./routes/script-editor.js";
import { projectsRoutes } from "./routes/projects.js";
import { scenesRoutes } from "./routes/scenes.js";
import { voiceProfilesRoutes } from "./routes/voice-profiles.js";
import { assetsRoutes } from "./routes/assets.js";
import { youtubeOauthRoutes } from "./routes/youtube-oauth.js";

export function buildApiApp() {
  const app = Fastify({
    logger: false,
  });

  void app.register(multipart);

  app.get("/health", async () => {
    return {
      service: "api",
      status: "ok",
    };
  });

  app.register(projectsRoutes);
  app.register(scenesRoutes);
  app.register(scriptEditorRoutes);
  app.register(voiceProfilesRoutes);
  app.register(audioPreviewRoutes);
  app.register(assetsRoutes);
  app.register(youtubeOauthRoutes);

  return app;
}
