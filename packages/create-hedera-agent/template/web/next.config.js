import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// `.env` sits at the template root (one level above `web/`) so the CLI and
// the web app share it. Loading here makes server components, route handlers,
// and the dev/build workers all see the variables.
dotenv.config({ path: resolve(__dirname, "..", ".env") });

/** @type {import("next").NextConfig} */
const nextConfig = {
  // `shared/config.js` lives one level above `web/`; trace from the template
  // root so the bundler picks it up.
  outputFileTracingRoot: resolve(__dirname, ".."),
  turbopack: {
    root: resolve(__dirname, ".."),
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
