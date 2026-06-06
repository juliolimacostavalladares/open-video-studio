import Fastify from "fastify";

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

  app.register(scenesRoutes);

  return app;
}
