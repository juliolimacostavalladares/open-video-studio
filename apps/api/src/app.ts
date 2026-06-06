import Fastify from "fastify";

import { scriptEditorRoutes } from "./routes/script-editor.js";

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

  app.register(scriptEditorRoutes);

  return app;
}
