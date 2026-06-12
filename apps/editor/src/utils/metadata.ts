import type { Metadata } from "next/types";

export function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: "https://openvideostudio.local",
      images: "/icon.svg",
      siteName: "Open Video Studio",
      ...override.openGraph
    },
    twitter: {
      card: "summary_large_image",
      creator: "@openvideostudio",
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      images: "/icon.svg",
      ...override.twitter
    },
    icons: {
      icon: "/icon.svg"
    }
  };
}

export const baseUrl =
  process.env.NODE_ENV === "development"
    ? new URL("http://localhost:3000")
    : new URL("https://openvideostudio.local");
