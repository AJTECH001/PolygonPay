import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16.
  // The packages below are Node.js-only deps pulled in by wagmi/viem/WalletConnect
  // that must not be bundled for the browser — Turbopack resolves them via
  // resolveAlias (mapping to empty modules) instead of webpack externals.
  turbopack: {
    resolveAlias: {
      "pino-pretty": { browser: "./src/lib/empty-module.ts" },
      "lokijs": { browser: "./src/lib/empty-module.ts" },
      "encoding": { browser: "./src/lib/empty-module.ts" },
      "@react-native-async-storage/async-storage": { browser: "./src/lib/empty-module.ts" },
    },
  },
};

export default nextConfig;
