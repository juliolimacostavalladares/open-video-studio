import React from "react";
import { Composition } from "remotion";
import { VerticalVideo, FPS } from "./VerticalVideo";
import type { VerticalVideoProps } from "./types";

export const Root: React.FC = () => {
  return (
    <Composition
      id="VerticalVideo"
      component={VerticalVideo}
      durationInFrames={150} // Default duration, overridden dynamically during render
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{
        scenes: [] as VerticalVideoProps["scenes"],
      }}
    />
  );
};
