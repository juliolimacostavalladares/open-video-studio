export interface VideoScene {
  id: string;
  orderIndex: number;
  script: string;
  audioPath: string | null;
  audioDurationSeconds: number | null;
  assetPath: string | null;
  assetKind: "image" | "video" | null;
}

export interface VerticalVideoProps {
  scenes?: VideoScene[];
}
