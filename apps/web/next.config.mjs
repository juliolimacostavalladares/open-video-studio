/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const editorOrigin =
      process.env.EDITOR_INTERNAL_URL ?? "http://localhost:3002";

    return [
      {
        source: "/editor",
        destination: `${editorOrigin}/editor`,
      },
      {
        source: "/editor/:path*",
        destination: `${editorOrigin}/editor/:path*`,
      },
    ];
  },
};

export default nextConfig;
