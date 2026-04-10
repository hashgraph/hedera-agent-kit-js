// Read-only registry probe.
//
// This module does NOT shell out to the npm CLI and does NOT publish anything.
// It sends an HTTPS HEAD request to the public npm registry to ask
// "does this version of this package already exist?" — used by validate.js to
// decide whether a package needs to be published.
//
// All actual publishing (`npm publish`) happens directly in the workflow,
// authenticated via NODE_AUTH_TOKEN against the registry that
// actions/setup-node configures. This URL is used ONLY for the read-only
// existence check.

const https = require('node:https');

const REGISTRY_URL = 'https://registry.npmjs.org';

/**
 * Returns true if the given (name, version) tuple is already published on the
 * public npm registry.
 *
 * Sends a HEAD request to https://registry.npmjs.org/<name>/<version>:
 *   200 -> already published (no publish needed)
 *   404 -> not yet published (publish required)
 *   anything else -> throws, so the caller fails loudly rather than silently skipping
 */
function isPublished(name, version) {
  const url = `${REGISTRY_URL}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      // Drain so the socket can be reused
      res.resume();
      const status = res.statusCode ?? 0;

      if (status === 200) return resolve(true);
      if (status === 404) return resolve(false);
      return reject(
        new Error(
          `Unexpected status ${status} from ${url} when checking if ${name}@${version} is published`,
        ),
      );
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

module.exports = { isPublished };
