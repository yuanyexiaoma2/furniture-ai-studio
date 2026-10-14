import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "exceljs", "mammoth"],
  ...(process.env.AGENT_TEST_DIST === "1" ? { distDir: ".next-agent-test" } : {}),
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  experimental: { authInterrupts: true, proxyClientMaxBodySize: "102mb" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
