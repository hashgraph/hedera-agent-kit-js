const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const CORE_PKG_DIR = 'packages/core';

/**
 * Discovers all publishable packages under packages/*.
 * A package is publishable when its package.json has a `name` and is not `private`.
 *
 * Returns an array of:
 *   { name, version, dir, absDir, manifest }
 * where `dir` is repo-relative (e.g. "packages/core") and `manifest` is the parsed package.json.
 */
function discoverPackages() {
  const entries = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const absDir = path.join(PACKAGES_DIR, entry.name);
    const manifestPath = path.join(absDir, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.name || manifest.private === true) continue;

    packages.push({
      name: manifest.name,
      version: manifest.version,
      dir: path.relative(REPO_ROOT, absDir),
      absDir,
      manifest,
    });
  }

  // Stable order: core first (the headline package), then alphabetical by name.
  packages.sort((a, b) => {
    if (a.dir === CORE_PKG_DIR) return -1;
    if (b.dir === CORE_PKG_DIR) return 1;
    return a.name.localeCompare(b.name);
  });

  return packages;
}

/**
 * Returns the version string from packages/core/package.json.
 * Throws if the file is missing or unreadable.
 */
function readCoreVersion() {
  const manifestPath = path.join(REPO_ROOT, CORE_PKG_DIR, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
}

/**
 * Computes the .tgz filename `pnpm pack` produces for a given package.
 * pnpm strips the leading "@" and replaces the "/" in scoped names with "-".
 * Example: "@hashgraph/hedera-agent-kit" @ 4.1.0 -> "hashgraph-hedera-agent-kit-4.1.0.tgz"
 */
function tarballName(pkgName, version) {
  const cleaned = pkgName.replace(/^@/, '').replace(/\//g, '-');
  return `${cleaned}-${version}.tgz`;
}

/**
 * Computes the GitHub Actions artifact name for a package.
 * Example: "@hashgraph/hedera-agent-kit" -> "pkg-hashgraph-hedera-agent-kit"
 */
function artifactName(pkgName) {
  const cleaned = pkgName.replace(/^@/, '').replace(/\//g, '-');
  return `pkg-${cleaned}`;
}

module.exports = {
  REPO_ROOT,
  PACKAGES_DIR,
  CORE_PKG_DIR,
  discoverPackages,
  readCoreVersion,
  tarballName,
  artifactName,
};
