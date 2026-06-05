import { buildApiApp } from "./app.js";

const app = buildApiApp();
const apiPort = Number(process.env.API_PORT ?? "4000");

app
  .listen({
    host: "0.0.0.0",
    port: apiPort
  })
  .catch(async (error) => {
    app.log.error(error);
    await app.close();
    process.exit(1);
  });
