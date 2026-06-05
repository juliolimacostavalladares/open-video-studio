import { afterEach } from "vitest";

import { stopAllProcesses } from "./process.js";

afterEach(() => {
  stopAllProcesses();
});
