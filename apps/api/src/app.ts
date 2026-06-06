import Fastify from "fastify";

import { scriptEditorRoutes } from "./routes/script-editor.js";
import { projectsRoutes } from "./routes/projects.js";
import { scenesRoutes } from "./routes/scenes.js";

export function buildApiApp() {
  const app = Fastify({
    logger: false
  });

  app.get("/health", async () => {
    return {
      service: "api",
      status: "ok"
    };
  });

  app.register(projectsRoutes);
  app.register(scenesRoutes);
  app.register(scriptEditorRoutes);

  return app;
}
