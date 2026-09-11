import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /* Hide the dev-tools badge — the console should preview as a finished product */
  devIndicators: false,
};

export default nextConfig;
