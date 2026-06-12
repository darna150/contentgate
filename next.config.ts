import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Document uploads go through a server action as FormData
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
