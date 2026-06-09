import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  type BrowserLog,
} from "@remotion/renderer";
import type { VerticalVideoProps } from "@repo/video";

export async function renderVideo(
  props: VerticalVideoProps,
  outputPath: string,
): Promise<void> {
  const fps = 30;
  let totalFrames = 0;

  if (props.scenes) {
    for (const scene of props.scenes) {
      const durationSeconds = scene.audioDurationSeconds || 3.0;
      totalFrames += Math.ceil(durationSeconds * fps);
    }
  }

  if (totalFrames === 0) {
    totalFrames = 90;
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const entryPoint = join(currentDir, "../../video/src/entry.tsx");

  const serveUrl = await bundle({
    entryPoint,
  });

  const compositionId = "VerticalVideo";
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: props as Record<string, unknown>,
    logLevel: "verbose",
    onBrowserLog: (log: BrowserLog) => {
      console.log(`[BROWSER LOG] [${log.type}] ${log.text}`);
    },
  });

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
    },
    serveUrl,
    outputLocation: outputPath,
    inputProps: props as Record<string, unknown>,
    codec: "h264",
    concurrency: 1,
    logLevel: "verbose",
    onBrowserLog: (log: BrowserLog) => {
      console.log(`[BROWSER LOG] [${log.type}] ${log.text}`);
    },
  });
}
