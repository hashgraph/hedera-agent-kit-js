// Read the bundled template/ directory (or any directory) into a FileMap
// suitable for passing to `applyScaffoldRule`. Pure I/O — no CLI deps.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files / directories never copied into the scaffolded output. Mirrors the
// behavior the local CLI relies on so the portal produces byte-equivalent zips.
const DEFAULT_DENYLIST = new Set(["node_modules", ".next", ".env", ".env.local"]);

// Absolute path to the template that ships in this package. Useful for the
// portal during local development; production portal builds typically snapshot
// the directory at build time.
export const bundledTemplateDir = path.resolve(__dirname, "template");

// Walk `dir` and return a `Record<string, Buffer>` keyed by POSIX-style
// relative path. Anything in `denylist` (matched by basename) is skipped.
export function readTemplateFileMap(dir = bundledTemplateDir, { denylist = DEFAULT_DENYLIST } = {}) {
  const files = {};
  walk(dir, "");

  function walk(absDir, relDir) {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (denylist.has(entry.name)) continue;
      const absPath = path.resolve(absDir, entry.name);
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(absPath, relPath);
      } else if (entry.isFile()) {
        files[relPath] = fs.readFileSync(absPath);
      }
    }
  }

  return files;
}
