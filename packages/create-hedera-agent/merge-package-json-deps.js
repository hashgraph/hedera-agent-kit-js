// Generic dep-merger for scaffold file maps. Same family as
// `applyScaffoldRule` and `readTemplateFileMap`: pure, no I/O, byte-clean
// output. Used by the Hedera Portal's two download pipelines so they don't
// each carry their own JSON-merge implementation.
//
// The function has zero knowledge of *which* packages get added — callers
// supply the deps record. The portal's plugin registry stays portal-side.

export function mergePackageJsonDeps(fileMap, deps, options = {}) {
  if (!deps || Object.keys(deps).length === 0) return fileMap;

  const packageJsonPath = options.packageJsonPath ?? "package.json";
  const existingBytes = fileMap[packageJsonPath];
  if (!existingBytes) {
    throw new Error(
      `mergePackageJsonDeps: file map is missing "${packageJsonPath}".`,
    );
  }

  let pkg;
  try {
    pkg = JSON.parse(decodeUtf8(existingBytes));
  } catch (err) {
    throw new Error(
      `mergePackageJsonDeps: "${packageJsonPath}" is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const existing = pkg.dependencies ?? {};
  pkg.dependencies = sortKeys({ ...existing, ...deps });

  return {
    ...fileMap,
    [packageJsonPath]: encodeUtf8(JSON.stringify(pkg, null, 2) + "\n"),
  };
}

function sortKeys(record) {
  const out = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key];
  return out;
}

// Portable utf-8 codec: callers may pass Node `Buffer` (CLI) or raw
// `Uint8Array` (browser via `fflate`). `Buffer extends Uint8Array`, but
// `Uint8Array.prototype.toString("utf8")` is a no-op (returns the
// comma-separated digits) — so we route through `TextDecoder` / `TextEncoder`
// which work on both.
function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeUtf8(text) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(text, "utf8");
  }
  return new TextEncoder().encode(text);
}
