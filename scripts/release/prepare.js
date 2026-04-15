#!/usr/bin/env node
/**
 * scripts/release/prepare.js
 *
 * Builds the release publish matrix. ASSUMES validate.js has already been run
 * and passed — this script does no validation beyond what's structurally
 * needed to compute the matrix. If you have not run validate.js first, results
 * may be misleading (e.g., a package with bad semver could end up in the matrix).
 *
 * What it does:
 *
 *   1. Discovers publishable packages.
 *   2. For each package, queries the npm registry to determine whether the
 *      version in package.json is already published.
 *   3. Builds a `publishMatrix` of packages that need publishing, with the
 *      exact `npm publish` flags pre-computed for each one.
 *   4. Emits the matrix as JSON to stdout (and optionally to GitHub Actions
 *      outputs / a pretty table on stderr).
 *
 * Usage:
 *   node scripts/release/prepare.js [options]
 *
 * Options:
 *   --tag <tag>   Tag for this release (used only for output — NOT validated
 *                 here, that's validate.js's job).
 *   --dry-run     Append `--dry-run` to each package's publishArgs.
 *   --json        Emit machine-readable JSON instead of the human table.
 *
 * Default output: a human-readable table on stdout. With --json, the script
 * emits a JSON document instead. The script does NOT write to GitHub Actions
 * outputs directly — the workflow runs it with --json and extracts whatever
 * it needs using `jq`. This keeps the script portable and free of CI-specific
 * plumbing.
 *
 * --json output shape:
 *   {
 *     "tag": "v4.1.0" | null,
 *     "coreVersion": "4.1.0",
 *     "publishMatrix": [
 *       { name, dir, version, tarball, artifactName,
 *         prerelease, prereleaseType, publishArgs }, ...
 *     ],
 *     "summary": [ { name, version, publishRequired, prereleaseType }, ... ],
 *     "hasPublishWork": true | false
 *   }
 *
 * Exit codes:
 *   0  matrix built successfully (even if hasPublishWork is false)
 *   1  argument parsing or filesystem error
 *   2  npm registry unreachable
 */

const semver = require('semver');
const {
  discoverPackages,
  readCoreVersion,
  tarballName,
  artifactName,
} = require('./packages');
const { isPublished } = require('./registry');

// Returns one of "production", "beta", or "unsupported" for a package version.
// validate.js refuses "unsupported", so by the time prepare.js runs we should
// only ever see "production" or "beta" — but we keep the third case so a
// stale or skipped validate run doesn't silently emit a wrong --tag flag.
function classifyPrerelease(version) {
  const prereleaseParts = semver.prerelease(version);
  if (!prereleaseParts) return 'production';
  const isBeta = prereleaseParts.some((p) => typeof p === 'string' && /beta/i.test(p));
  return isBeta ? 'beta' : 'unsupported';
}

function parseArgs(argv) {
  const opts = {
    tag: null,
    dryRun: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--tag':
        opts.tag = argv[++i] || null;
        if (opts.tag === '') opts.tag = null;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function printUsage() {
  process.stderr.write(
    [
      'Usage: node scripts/release/prepare.js [options]',
      '',
      'Options:',
      '  --tag <tag>   Tag for this release (used in output only).',
      '  --dry-run     Add --dry-run to each publishArgs.',
      '  --json        Emit machine-readable JSON instead of a human table.',
      '',
    ].join('\n'),
  );
}

function fail(message, code = 1) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function buildPublishArgs(prereleaseType, dryRun) {
  const parts = ['--access', 'public', '--no-git-checks'];
  if (dryRun) parts.push('--dry-run');
  if (prereleaseType !== 'production') parts.push('--tag', prereleaseType);
  return parts.join(' ');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const packages = discoverPackages();
  if (packages.length === 0) fail('no publishable packages discovered');

  // Classify each version's prerelease type. We trust validate.js has already
  // enforced semver and prerelease-type rules; this is just to know whether
  // to add `--tag beta` to publishArgs.
  for (const pkg of packages) {
    pkg.prereleaseType = classifyPrerelease(pkg.version);
  }

  // Query the registry to determine which packages still need publishing.
  await Promise.all(
    packages.map(async (pkg) => {
      try {
        const published = await isPublished(pkg.name, pkg.version);
        pkg.publishRequired = !published;
      } catch (err) {
        fail(
          `npm registry check failed for ${pkg.name}@${pkg.version}: ${err.message}`,
          2,
        );
      }
    }),
  );

  // Build the publish matrix.
  const publishMatrix = packages
    .filter((p) => p.publishRequired)
    .map((p) => ({
      name: p.name,
      dir: p.dir,
      version: p.version,
      tarball: tarballName(p.name, p.version),
      artifactName: artifactName(p.name),
      prerelease: p.prereleaseType !== 'production',
      prereleaseType: p.prereleaseType,
      publishArgs: buildPublishArgs(p.prereleaseType, opts.dryRun),
    }));

  const summary = packages.map((p) => ({
    name: p.name,
    dir: p.dir,
    version: p.version,
    publishRequired: p.publishRequired,
    prereleaseType: p.prereleaseType,
  }));

  const result = {
    tag: opts.tag,
    coreVersion: readCoreVersion(),
    publishMatrix,
    summary,
    hasPublishWork: publishMatrix.length > 0,
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printPretty(result);
  }
}

function printPretty(result) {
  const w = (s) => process.stdout.write(`${s}\n`);
  w('');
  w(`Core version: ${result.coreVersion}`);
  w(`Tag:          ${result.tag ?? '(none — subpackage-only mode)'}`);
  w('');

  const rows = result.summary.map((s) => ({
    name: s.name,
    version: s.version,
    onNpm: s.publishRequired ? 'no' : 'yes',
    action: s.publishRequired ? 'publish' : 'skip',
  }));

  const colWidths = {
    name: Math.max(7, ...rows.map((r) => r.name.length)),
    version: Math.max(7, ...rows.map((r) => r.version.length)),
    onNpm: Math.max(6, ...rows.map((r) => r.onNpm.length)),
    action: Math.max(6, ...rows.map((r) => r.action.length)),
  };

  const pad = (s, n) => s + ' '.repeat(n - s.length);
  w(
    [
      pad('Package', colWidths.name),
      pad('Version', colWidths.version),
      pad('On npm', colWidths.onNpm),
      pad('Action', colWidths.action),
    ].join('  '),
  );
  w(
    [
      '-'.repeat(colWidths.name),
      '-'.repeat(colWidths.version),
      '-'.repeat(colWidths.onNpm),
      '-'.repeat(colWidths.action),
    ].join('  '),
  );
  for (const r of rows) {
    w(
      [
        pad(r.name, colWidths.name),
        pad(r.version, colWidths.version),
        pad(r.onNpm, colWidths.onNpm),
        pad(r.action, colWidths.action),
      ].join('  '),
    );
  }
  w('');
  w(`Total to publish: ${result.publishMatrix.length}`);
  w('');
}

main().catch((err) => {
  process.stderr.write(`error: ${err.stack || err.message}\n`);
  process.exit(1);
});
