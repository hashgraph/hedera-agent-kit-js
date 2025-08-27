import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // silences error caused by nextjs selected parent lockfile
  // ref https://github.com/vercel/next.js/issues/81864#issuecomment-3132463064
  outputFileTracingRoot: __dirname
};

export default nextConfig;
