// Scaffold rule: pure transformation from the source-repo template file map to
// a single-runtime scaffolded output. Same rule is consumed by the local
// scaffolder (`index.js`) and (in the future) by the Hedera Portal, so portal
// downloads and CLI scaffolds are byte-for-byte identical for the same flag set.

export const FRAMEWORKS = ["ai-sdk", "langchain"];

const SUFFIX_RE = /^(.+)\.(ai-sdk|langchain)(\.[a-zA-Z0-9]+)$/;

export function applyScaffoldRule(files, framework) {
  if (!FRAMEWORKS.includes(framework)) {
    throw new Error(
      `Unknown framework "${framework}". Expected one of: ${FRAMEWORKS.join(", ")}.`,
    );
  }

  const result = {};

  for (const [filePath, content] of Object.entries(files)) {
    const match = filePath.match(SUFFIX_RE);
    if (!match) {
      if (filePath.endsWith("/package.json") || filePath === "package.json") {
        result[filePath] = rewritePackageJson(content, framework);
        continue;
      }
      result[filePath] = content;
      continue;
    }
    const [, base, suffix, ext] = match;
    if (suffix === framework) {
      result[`${base}${ext}`] = content;
    }
    // Files for the other framework are dropped.
  }

  return result;
}

function rewritePackageJson(content, framework) {
  let pkg;
  try {
    pkg = JSON.parse(decodeUtf8(content));
  } catch {
    return content;
  }

  const runtimeDeps = pkg.runtimeDeps || {};
  const dependencies = pkg.dependencies || {};

  // Remove every dep listed under the *other* runtime(s).
  for (const otherFramework of FRAMEWORKS) {
    if (otherFramework === framework) continue;
    const otherDeps = runtimeDeps[otherFramework];
    if (!Array.isArray(otherDeps)) continue;
    for (const name of otherDeps) delete dependencies[name];
  }
  pkg.dependencies = sortKeys(dependencies);
  delete pkg.runtimeDeps;

  const scripts = pkg.scripts || {};
  delete scripts["cli:ai-sdk"];
  delete scripts["cli:langchain"];
  pkg.scripts = { ...scripts, cli: "node cli/index.js" };

  return encodeUtf8(JSON.stringify(pkg, null, 2) + "\n");
}

function sortKeys(record) {
  const out = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key];
  return out;
}

// Portable utf-8 codec: the caller may pass a Node `Buffer` (CLI scaffolder)
// or a raw `Uint8Array` (browser-side portal pipeline via `fflate`). `Buffer`
// extends `Uint8Array`, but `Uint8Array.prototype.toString("utf8")` is a no-op
// (returns the comma-separated digits) — so we route through `TextDecoder` /
// `TextEncoder` which work on both.
function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeUtf8(text) {
  // Prefer Node `Buffer` when available so the value matches the rest of the
  // CLI scaffolder's bytes (and so callers can use `.toString("utf8")`).
  // Browsers fall through to the raw `Uint8Array` from `TextEncoder`.
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(text, "utf8");
  }
  return new TextEncoder().encode(text);
}
