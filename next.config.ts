import type { NextConfig } from "next";

// Defense-in-depth headers. The CSP intentionally sets only directives that
// cannot break Next.js runtime behavior (no default-src/script-src, which
// would require nonce plumbing); tightening it further is tracked separately.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  // Keep this config file deploy-visible so PR QA changes still receive Vercel checks.
  serverExternalPackages: ["officeparser"],
  outputFileTracingExcludes: {
    "/api/*": [
      "public/assets/**/*",
      "public/template-packages/**/*",
    ],
  },
  experimental: {
    serverActions: {
      // Document uploads go through a server action as FormData
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
