import Fastify from "fastify";

import { projectsRoutes } from "./routes/projects.js";

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

  return app;
}
