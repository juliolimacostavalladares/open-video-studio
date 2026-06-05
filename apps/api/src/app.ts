import Fastify from "fastify";

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

  return app;
}
