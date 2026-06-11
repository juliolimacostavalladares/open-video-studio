import "dotenv/config";
import { buildApiApp } from "./app.js";
import { createPipelineWorker } from "@repo/infrastructure";

const app = buildApiApp();
const apiPort = Number(process.env.API_PORT ?? "4000");

const { close: closeWorker } = createPipelineWorker();

app.addHook("onClose", async () => {
  await closeWorker();
});

app
  .listen({
    host: "0.0.0.0",
    port: apiPort,
  })
  .catch(async (error) => {
    app.log.error(error);
    await app.close();
    process.exit(1);
  });
