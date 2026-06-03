import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@remotion/player", "@remotion/transitions"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  /* config options here */
};

export default nextConfig;
