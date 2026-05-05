#!/usr/bin/env node
/**
 * scripts/release/validate.js
 *
 * Validates that the current state of the repo is releasable. Pure pass/fail —
 * no JSON output, no matrix building. If validation passes, the script exits
 * with code 0 and writes a single "OK" line to stderr. On failure it writes
 * an error to stderr and exits non-zero.
 *
 * Validation rules:
 *
 *   1. Every publishable package's `version` in package.json must be valid
 *      semver (MAJOR.MINOR.PATCH[-PRERELEASE]).
 *   2. Any prerelease component must contain "beta". Other prerelease types
 *      (alpha, rc, etc.) are rejected — the publish flow only knows how to
 *      tag betas.
 *   3. If --tag is provided, the tag must start with "v" and the rest must
 *      equal packages/core/package.json#version exactly.
 *   4. If --tag is NOT provided, packages/core MUST already be on the npm
 *      registry. This enforces the rule that any release including core MUST
 *      be triggered by pushing a v<core-version> tag.
 *
 * The single npm registry HEAD request in rule 4 is the only network call
 * this script makes. Building the publish matrix and querying the registry
 * for every package is the job of scripts/release/prepare.js.
 *
 * Usage:
 *   node scripts/release/validate.js [--tag <tag>]
 *
 * Exit codes:
 *   0  validation passed
 *   1  validation failed (bad semver, tag mismatch, etc.)
 *   2  network failure during the rule-4 registry check
 */

const semver = require('semver');
const {
  discoverPackages,
  readCoreVersion,
  CORE_PKG_DIR,
} = require('./packages');
const { isPublished } = require('./registry');

// We accept production releases (no prerelease component) and beta releases
// (any prerelease component identifier matching /beta/i). Anything else is
// rejected because the publish step only knows how to tag betas.
function isBetaPrerelease(prereleaseParts) {
  return prereleaseParts.some((p) => typeof p === 'string' && /beta/i.test(p));
}

function parseArgs(argv) {
  const opts = { tag: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--tag':
        opts.tag = argv[++i] || null;
        if (opts.tag === '') opts.tag = null;
        break;
      case '--help':
      case '-h':
        process.stderr.write('Usage: node scripts/release/validate.js [--tag <tag>]\n');
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function fail(message, code = 1) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // Rule 1 + 2: every package version must be valid semver and not an
  // unsupported prerelease type.
  const packages = discoverPackages();
  if (packages.length === 0) fail('no publishable packages discovered');

  for (const pkg of packages) {
    if (!semver.valid(pkg.version)) {
      fail(`${pkg.name} (${pkg.dir}): "${pkg.version}" is not a valid semver`);
    }
    const prereleaseParts = semver.prerelease(pkg.version);
    if (prereleaseParts && !isBetaPrerelease(prereleaseParts)) {
      fail(
        `${pkg.name} (${pkg.dir}): version "${pkg.version}" has unsupported prerelease type. Only "beta" prereleases are supported.`,
      );
    }
  }

  // Rule 3: if a tag was provided, it must equal v<core-version>.
  const coreVersion = readCoreVersion();
  if (opts.tag !== null) {
    if (!opts.tag.startsWith('v')) {
      fail(`tag "${opts.tag}" must start with "v"`);
    }
    if (opts.tag.slice(1) !== coreVersion) {
      fail(
        `tag "${opts.tag}" does not match packages/core version "v${coreVersion}". The release tag must equal v<packages/core/package.json#version>.`,
      );
    }
  }

  // Rule 4: if no tag was provided, core must already be on npm.
  // (This enforces "any release that includes core requires a tag".)
  if (opts.tag === null) {
    const corePkg = packages.find((p) => p.dir === CORE_PKG_DIR);
    if (corePkg) {
      let coreOnNpm;
      try {
        coreOnNpm = await isPublished(corePkg.name, corePkg.version);
      } catch (err) {
        fail(
          `npm registry check failed for ${corePkg.name}@${corePkg.version}: ${err.message}`,
          2,
        );
      }
      if (!coreOnNpm) {
        fail(
          `core release detected (${corePkg.name}@${corePkg.version} is not on npm) but no tag was provided. Releases that include core MUST be triggered by pushing a v<core-version> tag.`,
        );
      }
    }
  }

  process.stderr.write('validate: OK\n');
}

main().catch((err) => {
  process.stderr.write(`error: ${err.stack || err.message}\n`);
  process.exit(1);
});
