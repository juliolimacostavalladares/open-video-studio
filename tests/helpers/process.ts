import { spawn, type ChildProcess, type SpawnOptions, spawnSync } from "node:child_process";

const runningProcesses = new Set<ChildProcess>();

export function runCommandSync(command: string, args: string[], options: SpawnOptions = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    encoding: "utf-8",
    ...options
  });
}

export function startProcess(command: string, args: string[], options: SpawnOptions = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    ...options
  });

  runningProcesses.add(child);
  child.once("exit", () => {
    runningProcesses.delete(child);
  });

  return child;
}

export function stopAllProcesses() {
  for (const child of runningProcesses) {
    child.kill("SIGTERM");
  }

  runningProcesses.clear();
}
