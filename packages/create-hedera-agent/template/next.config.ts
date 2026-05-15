import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // silences error caused by nextjs selected parent lockfile
  // ref https://github.com/vercel/next.js/issues/81864#issuecomment-3132463064
  outputFileTracingRoot: __dirname,
  experimental: {
    // `lucide-react` ships as a barrel; without this Next can pull the entire
    // icon set into the client bundle. Listing it makes named imports
    // tree-shake cleanly across all client routes (Vercel `bundle-barrel-imports`).
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
