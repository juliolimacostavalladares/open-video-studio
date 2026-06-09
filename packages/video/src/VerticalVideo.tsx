import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, Video } from "remotion";
import type { VerticalVideoProps, VideoScene } from "./types";

// Standard FPS
export const FPS = 30;

export function calculateScenesTiming(scenes: VideoScene[], fps: number) {
  let currentFrame = 0;
  return scenes.map((scene) => {
    const durationSeconds = scene.audioDurationSeconds || 3.0;
    const durationFrames = Math.ceil(durationSeconds * fps);
    const startFrame = currentFrame;
    currentFrame += durationFrames;
    return {
      ...scene,
      startFrame,
      durationFrames,
    };
  });
}

export const VerticalVideo: React.FC<VerticalVideoProps> = ({
  scenes = [],
}) => {
  if (!scenes || scenes.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#000000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{ color: "#ffffff", fontSize: 40, fontFamily: "sans-serif" }}
        >
          Nenhuma cena disponível
        </div>
      </AbsoluteFill>
    );
  }

  const scenesWithTiming = calculateScenesTiming(scenes, FPS);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {scenesWithTiming.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
        >
          <SceneSegment scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SceneSegment: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  return (
    <AbsoluteFill>
      {/* Visual background asset with crop/fit to vertical layout */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {scene.assetPath ? (
          scene.assetKind === "video" ? (
            <Video
              src={scene.assetPath}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              muted
            />
          ) : (
            <Img
              src={scene.assetPath}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )
        ) : (
          // Default placeholder background if no asset is selected/fallback
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(180deg, #1e1b4b 0%, #311042 100%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          />
        )}
      </div>

      {/* Audio narration */}
      {scene.audioPath && <Audio src={scene.audioPath} />}

      {/* Captions / Subtitles overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 150,
          left: 50,
          right: 50,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p
          style={{
            color: "#ffffff",
            fontSize: 44,
            fontWeight: "bold",
            textAlign: "center",
            fontFamily: "Inter, system-ui, sans-serif",
            textShadow:
              "0px 4px 12px rgba(0, 0, 0, 0.9), 0px 0px 4px rgba(0, 0, 0, 0.9)",
            margin: 0,
            padding: "16px 24px",
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: 16,
            backdropFilter: "blur(4px)",
            lineHeight: 1.3,
          }}
        >
          {scene.script}
        </p>
      </div>
    </AbsoluteFill>
  );
};
