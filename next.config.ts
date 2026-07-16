import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep this config file deploy-visible so PR QA changes still receive Vercel checks.
  serverExternalPackages: ["officeparser"],
  experimental: {
    serverActions: {
      // Document uploads go through a server action as FormData
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
