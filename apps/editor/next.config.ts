import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
	/* config options here */
	basePath: "/editor",
	reactStrictMode: false,
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
};

export default nextConfig;
