import { prisma, sceneHasValidAudio } from "@repo/database";
import type { VerticalVideoProps, VideoScene } from "@repo/video";

/**
 * Builds the render timeline props for a project by querying scenes from the database,
 * sorting them by orderIndex, resolving paths to absolute URLs, and validating that
 * valid audio exists for every scene.
 */
export async function buildVideoTimeline(
  projectId: string,
  apiUrl: string,
): Promise<VerticalVideoProps> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      voiceProfileId: true,
      scenes: {
        orderBy: { orderIndex: "asc" },
        include: {
          asset: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (project.scenes.length === 0) {
    throw new Error("Project has no scenes to render");
  }

  // Helper to resolve S3 key paths to absolute HTTP URLs served by our API
  const resolveUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("data:")
    ) {
      return path;
    }
    return `${apiUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  };

  const scenes: VideoScene[] = [];
  const sortedScenes = [...project.scenes].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  for (const scene of sortedScenes) {
    // Validate that the scene has a valid audio for the selected voice profile
    const hasAudio = sceneHasValidAudio({
      audioContentHash: scene.audioContentHash,
      audioPath: scene.audioPath,
      script: scene.script,
      voiceProfileId: project.voiceProfileId,
    });

    if (!hasAudio || !scene.audioPath || !scene.audioDurationSeconds) {
      throw new Error(
        `Scene orderIndex ${scene.orderIndex} does not have valid audio generated`,
      );
    }

    // Determine asset kind mapping from DB format to Remotion format ("image" | "video" | null)
    let assetKind: "image" | "video" | null = null;
    if (scene.asset) {
      if (scene.asset.kind === "video") {
        assetKind = "video";
      } else if (scene.asset.kind === "image") {
        assetKind = "image";
      }
    }

    scenes.push({
      id: scene.id,
      orderIndex: scene.orderIndex,
      script: scene.script,
      audioPath: resolveUrl(scene.audioPath),
      audioDurationSeconds: scene.audioDurationSeconds,
      assetPath: scene.asset ? resolveUrl(scene.asset.path) : null,
      assetKind,
    });
  }

  return { scenes };
}
